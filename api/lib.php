<?php
/* ReyesFruitHub · núcleo de la API: conexión PDO, sesión, permisos, utilidades y PEPS. */
declare(strict_types=1);

$GLOBALS['RFH_CFG'] = require __DIR__ . '/config.php';
date_default_timezone_set($GLOBALS['RFH_CFG']['zona']);

final class ApiError extends Exception
{
    public function __construct(string $msg, public int $status = 400) { parent::__construct($msg); }
}

function fail(string $msg, int $status = 400): never { throw new ApiError($msg, $status); }

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

/* ---------- Base de datos ---------- */
function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = $GLOBALS['RFH_CFG'];
    $dsn = "mysql:host={$c['db_host']};port={$c['db_port']};dbname={$c['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,   // consultas preparadas reales (anti inyección SQL)
    ]);
    // Que NOW()/CURRENT_TIMESTAMP usen la misma zona horaria que PHP
    $pdo->exec("SET time_zone = '" . (new DateTime())->format('P') . "'");
    return $pdo;
}
function q(string $sql, array $p = []): PDOStatement { $st = db()->prepare($sql); $st->execute($p); return $st; }
function q1(string $sql, array $p = []): ?array { $r = q($sql, $p)->fetch(); return $r === false ? null : $r; }
function qall(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }
function qval(string $sql, array $p = []): mixed { return q($sql, $p)->fetchColumn(); }
function last_id(): int { return (int) db()->lastInsertId(); }

/** Ejecuta $fn dentro de una transacción; si algo falla, se deshace todo. */
function tx(callable $fn): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try { $r = $fn(); $pdo->commit(); return $r; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}

/* ---------- Sesión y permisos (mínimo privilegio) ---------- */
function iniciar_sesion(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('RFHSESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}

function usuario_actual(): ?array
{
    if (empty($_SESSION['uid'])) return null;
    $u = q1('SELECT * FROM usuarios WHERE id = ?', [$_SESSION['uid']]);
    if (!$u || !(int) $u['activo']) { $_SESSION = []; return null; }
    return $u;
}

function requerir(string ...$roles): array
{
    $u = usuario_actual();
    if (!$u) fail('Inicia sesión para continuar.', 401);
    if ($roles && !in_array($u['rol'], $roles, true)) fail('No tienes permiso para esta acción.', 403);
    return $u;
}

/* ---------- Validación de entradas ---------- */
function txt(array $in, string $k, int $max, bool $req = false, string $etq = ''): ?string
{
    $v = isset($in[$k]) && is_scalar($in[$k]) ? trim((string) $in[$k]) : '';
    if ($v === '') { if ($req) fail('Falta ' . ($etq ?: $k) . '.', 422); return null; }
    if (mb_strlen($v) > $max) fail(ucfirst($etq ?: $k) . " es demasiado largo (máx. $max caracteres).", 422);
    return $v;
}
function num(array $in, string $k, string $etq, float $min = 0, bool $estricto = true): float
{
    $v = $in[$k] ?? null;
    if (!is_numeric($v)) fail("$etq debe ser un número.", 422);
    $v = round((float) $v, 2);
    if ($estricto ? $v <= $min : $v < $min) fail("$etq debe ser mayor " . ($estricto ? 'a' : 'o igual a') . " $min.", 422);
    if ($v > 99999999) fail("$etq es demasiado grande.", 422);
    return $v;
}
function ident(array $in, string $k, string $etq = 'el identificador'): int
{
    $v = $in[$k] ?? null;
    if (!is_scalar($v) || !ctype_digit((string) $v)) fail("Falta $etq.", 422);
    return (int) $v;
}
function email_ok(?string $e): bool { return $e !== null && filter_var($e, FILTER_VALIDATE_EMAIL) !== false; }
function tel_ok(?string $t): bool { return $t === null || strlen(preg_replace('/\D/', '', $t)) === 10; }

/** Cantidad válida según unidad: kg en pasos de 0.5, pieza/manojo enteros. */
function cantidad_valida(float $c, string $unidad): bool
{
    if ($c <= 0) return false;
    return $unidad === 'kg' ? fmod($c * 2, 1.0) == 0.0 : fmod($c, 1.0) == 0.0;
}

/* ---------- Formatos de salida (misma forma que espera el frontend) ---------- */
function iso(?string $dt): ?string { return $dt ? (new DateTime($dt))->format(DATE_ATOM) : null; }
function f(mixed $v): float { return round((float) $v, 2); }

/* ---------- Inventario ---------- */
function stock_de(int $pid): float { return f(qval('SELECT COALESCE(SUM(cantidad),0) FROM lotes WHERE producto_id = ?', [$pid])); }

function reservado_de(int $pid): float
{
    return f(qval("SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalle d JOIN pedidos p ON p.id = d.pedido_id
                   WHERE d.producto_id = ? AND p.estado IN ('pendiente','preparando','listo')", [$pid]));
}

/** Descuenta existencias por PEPS: primero el lote que caduca antes. Debe llamarse dentro de tx(). */
function consumir(int $pid, float $cant, string $nombre): void
{
    $lotes = qall('SELECT id, cantidad FROM lotes WHERE producto_id = ? AND cantidad > 0 ORDER BY fecha_caducidad, id FOR UPDATE', [$pid]);
    $resta = $cant;
    foreach ($lotes as $l) {
        if ($resta <= 0) break;
        $usa = min((float) $l['cantidad'], $resta);
        q('UPDATE lotes SET cantidad = cantidad - ? WHERE id = ?', [$usa, $l['id']]);
        $resta = round($resta - $usa, 2);
    }
    if ($resta > 0) fail("No hay existencia suficiente de $nombre.", 409);
}

/** Bloquea el producto (serializa ventas/pedidos concurrentes del mismo producto). */
function producto_bloqueado(int $pid): array
{
    $p = q1('SELECT * FROM productos WHERE id = ? FOR UPDATE', [$pid]);
    if (!$p) fail('El producto ya no existe.', 404);
    return $p;
}

/**
 * Valida una lista de artículos [{productoId, cantidad}] contra la BD.
 * Los precios SIEMPRE salen de la base, nunca del navegador.
 */
function preparar_items(mixed $items, bool $contraDisponible): array
{
    if (!is_array($items) || !$items) fail('Agrega al menos un producto.', 422);
    if (count($items) > 60) fail('Demasiados productos en una sola operación.', 422);
    $out = [];
    $vistos = [];
    foreach ($items as $it) {
        if (!is_array($it)) fail('Artículo no válido.', 422);
        $pid = ident($it, 'productoId', 'el producto');
        if (isset($vistos[$pid])) fail('Hay un producto repetido en la lista.', 422);
        $vistos[$pid] = true;
        $p = producto_bloqueado($pid);
        if (!(int) $p['activo']) fail("{$p['nombre']} ya no está a la venta.", 409);
        $c = num($it, 'cantidad', 'La cantidad de ' . $p['nombre']);
        if (!cantidad_valida($c, $p['unidad'])) fail("Cantidad no válida para {$p['nombre']} (" . ($p['unidad'] === 'kg' ? 'en pasos de 0.5 kg' : 'en unidades enteras') . ').', 422);
        $hay = stock_de($pid) - ($contraDisponible ? reservado_de($pid) : 0);
        if ($c > $hay + 0.0001) fail("Solo hay " . max(0, round($hay, 2)) . " {$p['unidad']} disponibles de {$p['nombre']}.", 409);
        $out[] = ['producto_id' => $pid, 'nombre' => $p['nombre'], 'unidad' => $p['unidad'], 'cantidad' => $c, 'precio' => f($p['precio'])];
    }
    return $out;
}
function total_items(array $items): float { return f(array_reduce($items, fn($s, $i) => $s + $i['cantidad'] * $i['precio'], 0)); }

function registrar_venta(array $items, string $canal, ?int $clienteId, ?int $pedidoId, string $metodo, ?int $usuarioId): array
{
    foreach ($items as $i) consumir($i['producto_id'], $i['cantidad'], $i['nombre']);
    q('INSERT INTO ventas (canal, cliente_id, pedido_id, metodo, total, usuario_id) VALUES (?,?,?,?,?,?)',
        [$canal, $clienteId, $pedidoId, $metodo, total_items($items), $usuarioId]);
    $id = last_id();
    $folio = 'V-' . (10000 + $id);
    q('UPDATE ventas SET folio = ? WHERE id = ?', [$folio, $id]);
    $st = db()->prepare('INSERT INTO venta_detalle (venta_id, producto_id, nombre, unidad, cantidad, precio) VALUES (?,?,?,?,?,?)');
    foreach ($items as $i) $st->execute([$id, $i['producto_id'], $i['nombre'], $i['unidad'], $i['cantidad'], $i['precio']]);
    return ['id' => $folio, 'total' => total_items($items)];
}
