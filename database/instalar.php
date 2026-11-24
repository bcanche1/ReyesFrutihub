<?php
/*
 * ReyesFruitHub · instalador de la base de datos (solo línea de comandos)
 *
 *   php database/instalar.php            crea la base si no existe y carga datos de ejemplo
 *   php database/instalar.php --reset    BORRA la base y la vuelve a crear (pide confirmación)
 *   php database/instalar.php --reset --si   igual, sin preguntar (lo usan las pruebas)
 *
 * Toma la conexión de api/config.php (variables RFH_DB, RFH_DB_USER, ... la sobrescriben).
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$cfg = require __DIR__ . '/../api/config.php';
date_default_timezone_set($cfg['zona']);
$reset = in_array('--reset', $argv, true);
$si = in_array('--si', $argv, true);
$nombre = $cfg['db_name'];
if (!preg_match('/^[A-Za-z0-9_]+$/', $nombre)) exit("Nombre de base no válido: $nombre\n");

function linea(string $s): void { fwrite(STDOUT, $s . PHP_EOL); }

try {
    $pdo = new PDO("mysql:host={$cfg['db_host']};port={$cfg['db_port']};charset=utf8mb4", $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
} catch (PDOException $e) {
    exit("✗ No pude conectar a MySQL en {$cfg['db_host']}:{$cfg['db_port']} con el usuario {$cfg['db_user']}: {$e->getMessage()}\n");
}
linea("✓ Conectado a " . $pdo->query('SELECT VERSION()')->fetchColumn());

$existe = (bool) $pdo->query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($nombre))->fetchColumn();
$tablas = $existe ? (int) $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = " . $pdo->quote($nombre))->fetchColumn() : 0;
if ($tablas > 0 && !$reset) exit("La base `$nombre` ya existe con $tablas tablas. Usa --reset para borrarla y recrearla.\n");
if ($reset && $existe && !$si) {
    fwrite(STDOUT, "Se BORRARÁ la base `$nombre` y todo su contenido. Escribe SI para continuar: ");
    if (trim((string) fgets(STDIN)) !== 'SI') exit("Cancelado.\n");
}
if ($reset) $pdo->exec("DROP DATABASE IF EXISTS `$nombre`");
$pdo->exec("CREATE DATABASE IF NOT EXISTS `$nombre` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `$nombre`");
$pdo->exec("SET time_zone = '" . (new DateTime())->format('P') . "'");
linea("✓ Base `$nombre` lista");

/* ---------- Esquema ---------- */
$sql = preg_replace('/^\s*--.*$/m', '', file_get_contents(__DIR__ . '/schema.sql'));
foreach (preg_split('/;\s*(\r?\n|$)/', $sql) as $stmt) if (trim($stmt) !== '') $pdo->exec($stmt);
linea('✓ Esquema aplicado (' . $pdo->query('SHOW FULL TABLES')->rowCount() . ' tablas y vistas)');

/* ---------- Datos de ejemplo (precios y costos son ilustrativos) ---------- */
mt_srand(20260918);
$r = fn(): float => mt_rand() / mt_getrandmax();
$dia = fn(int $n, int $h = 9, int $m = 0): string => (new DateTime('today'))->modify("$n day")->setTime($h, $m)->format('Y-m-d H:i:s');
$ins = function (string $sql, array $p) use ($pdo): int { $st = $pdo->prepare($sql); $st->execute($p); return (int) $pdo->lastInsertId(); };

$pdo->beginTransaction();

foreach ([['citricos', 'Cítricos'], ['tropicales', 'Tropicales'], ['frutas', 'Frutas de temporada'], ['verduras', 'Verduras'], ['hierbas', 'Hierbas y chiles']] as $c)
    $ins('INSERT INTO categorias (id, nombre) VALUES (?,?)', $c);

$provs = [
    ['Distribuidora Frutícola del Sureste', 'Ricardo Euán', '999 000 0101', 'ventas@fruticola-demo.mx', 'Lun, Mié, Vie', 'Entrega antes de las 8:00.', ['citricos', 'frutas']],
    ['Cooperativa Hortalizas Mayab', 'Lucía Chi', '999 000 0202', 'pedidos@mayab-demo.mx', 'Mar, Jue, Sáb', '', ['verduras', 'hierbas']],
    ['Tropicales de la Península', 'Javier Pool', '999 000 0303', 'contacto@tropicales-demo.mx', 'Lun, Jue', 'Pedido mínimo 20 kg.', ['tropicales']],
    ['Huerto Familiar Kantún', 'Rosa Kantún', '985 000 0404', 'huerto.kantun@demo.mx', 'Sábado', 'Productor local.', ['citricos', 'hierbas']],
];
$pv = [];
foreach ($provs as $i => $p) {
    $pv[$i + 1] = $ins('INSERT INTO proveedores (nombre, contacto, telefono, email, dias_entrega, notas) VALUES (?,?,?,?,?,?)', array_slice($p, 0, 6));
    foreach ($p[6] as $c) $ins('INSERT INTO proveedor_categoria (proveedor_id, categoria_id) VALUES (?,?)', [$pv[$i + 1], $c]);
}

// nombre, categoría, unidad, precio, costo, mínimo, vida (días), proveedor, forma, color, tono, destacado, archivo de foto
$prods = [
    ['Naranja dulce', 'citricos', 'kg', 24, 14, 20, 12, 1, 'redondo', '#f97316', 'orange', 1, 'naranja'],
    ['Naranja agria', 'citricos', 'kg', 30, 18, 8, 12, 4, 'redondo', '#ea8a1a', 'orange', 0, 'naranja-agria'],
    ['Limón persa', 'citricos', 'kg', 38, 24, 15, 14, 1, 'ovalo', '#65a30d', 'green', 1, 'limon'],
    ['Mandarina', 'citricos', 'kg', 32, 19, 10, 10, 1, 'redondo', '#fb923c', 'orange', 0, 'mandarina'],
    ['Toronja', 'citricos', 'pieza', 12, 6, 20, 14, 4, 'redondo', '#f59e0b', 'orange', 0, 'toronja'],
    ['Plátano tabasco', 'tropicales', 'kg', 22, 12, 15, 6, 3, 'largo', '#eab308', 'yellow', 1, 'platano'],
    ['Papaya maradol', 'tropicales', 'kg', 28, 15, 12, 5, 3, 'ovalo', '#f97316', 'green', 1, 'papaya'],
    ['Piña miel', 'tropicales', 'pieza', 45, 26, 8, 7, 3, 'ovalo', '#d97706', 'orange', 0, 'pina'],
    ['Mango ataulfo', 'tropicales', 'kg', 48, 30, 10, 6, 3, 'ovalo', '#facc15', 'yellow', 1, 'mango'],
    ['Guanábana', 'tropicales', 'kg', 70, 45, 4, 4, 3, 'ovalo', '#4d7c0f', 'green', 0, 'guanabana'],
    ['Pitahaya', 'tropicales', 'pieza', 35, 20, 6, 6, 3, 'ovalo', '#db2777', 'pink', 0, 'pitahaya'],
    ['Sandía', 'frutas', 'kg', 16, 8, 25, 8, 1, 'redondo', '#16a34a', 'red', 0, 'sandia'],
    ['Melón chino', 'frutas', 'pieza', 38, 21, 6, 7, 1, 'redondo', '#d9b56b', 'orange', 0, 'melon'],
    ['Manzana roja', 'frutas', 'kg', 52, 34, 10, 20, 1, 'redondo', '#dc2626', 'red', 1, 'manzana'],
    ['Uva verde', 'frutas', 'kg', 85, 58, 5, 7, 1, 'racimo', '#84cc16', 'green', 0, 'uva'],
    ['Fresa', 'frutas', 'kg', 90, 60, 4, 4, 1, 'punta', '#e11d48', 'red', 1, 'fresa'],
    ['Aguacate hass', 'frutas', 'kg', 68, 45, 8, 6, 1, 'ovalo', '#3f6212', 'green', 1, 'aguacate'],
    ['Jitomate saladet', 'verduras', 'kg', 26, 15, 15, 7, 2, 'redondo', '#ef4444', 'red', 0, 'jitomate'],
    ['Cebolla blanca', 'verduras', 'kg', 24, 13, 12, 20, 2, 'redondo', '#e7e5e4', 'stone', 0, 'cebolla'],
    ['Pepino', 'verduras', 'kg', 20, 10, 8, 8, 2, 'largo', '#15803d', 'green', 0, 'pepino'],
    ['Zanahoria', 'verduras', 'kg', 18, 9, 10, 15, 2, 'punta', '#f97316', 'orange', 0, 'zanahoria'],
    ['Lechuga romana', 'verduras', 'pieza', 22, 11, 10, 5, 2, 'hoja', '#22c55e', 'green', 0, 'lechuga'],
    ['Chile habanero', 'hierbas', 'kg', 120, 75, 2, 10, 4, 'punta', '#ea580c', 'orange', 1, 'habanero'],
    ['Cilantro', 'hierbas', 'manojo', 8, 3, 15, 4, 2, 'hoja', '#16a34a', 'green', 0, 'cilantro'],
];
$pid = [];
$fotos = 0;
foreach ($prods as $i => $p) {
    $foto = "assets/img/productos/{$p[12]}.webp";
    $img = is_file(__DIR__ . "/../$foto") ? $foto : null;
    if ($img) $fotos++;
    $pid[$i] = ['id' => $ins('INSERT INTO productos (nombre, categoria_id, unidad, precio, costo, stock_minimo, vida_dias, proveedor_id, forma, color, fondo, destacado, imagen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$p[0], $p[1], $p[2], $p[3], $p[4], $p[5], $p[6], $pv[$p[7]], $p[8], $p[9], $p[10], $p[11], $img]),
        'nombre' => $p[0], 'unidad' => $p[2], 'precio' => $p[3], 'costo' => $p[4], 'min' => $p[5], 'vida' => $p[6], 'prov' => $pv[$p[7]]];
}

$hash = password_hash('demo123', PASSWORD_DEFAULT);
$usuarios = [
    ['Administrador Reyes', 'admin@reyesfruithub.demo', 'admin', '', '', 1],
    ['Cliente Demo', 'cliente@reyesfruithub.demo', 'cliente', '985 000 1111', 'Calle [X] #[000], Valladolid', 1],
    ['María Pech', 'maria.pech@correo.demo', 'cliente', '985 000 2222', '', 1],
    ['José Canul', 'jose.canul@correo.demo', 'cliente', '985 000 3333', '', 1],
    ['Ana Tun', 'ana.tun@correo.demo', 'cliente', '', '', 0],
    ['Encargado de turno', 'turno@reyesfruithub.demo', 'admin', '', '', 1],
];
$uid = [];
foreach ($usuarios as $u) $uid[] = $ins('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, direccion, activo, creado) VALUES (?,?,?,?,?,?,?,?)',
    [$u[0], $u[1], $hash, $u[2], $u[3] ?: null, $u[4] ?: null, $u[5], $dia(-60 - (int) ($r() * 90))]);
$clientes = [$uid[1], $uid[2], $uid[3], $uid[4]];

// Lotes y compras (algunos quedan con stock bajo o por caducar a propósito)
$compras = [];
foreach ($pid as $i => $p) {
    $n = $r() < 0.45 ? 2 : 1;
    for ($k = 0; $k < $n; $k++) {
        $hace = (int) floor($r() * min($p['vida'], 6)) + ($k === 0 ? 1 : 0);
        $cant = round($p['min'] * (0.6 + $r() * 2.2));
        if ($i % 7 === 3 && $k === 0) $cant = max(1, round($p['min'] * 0.4));
        if ($i === 9) $cant = 0; // Guanábana agotada
        $entrada = $dia(-$hace, 7);
        $cad = ($i % 5 === 1 && $k === 0) ? $dia(1, 20) : $dia(-$hace + $p['vida'], 20);
        $key = $p['prov'] . '|' . substr($entrada, 0, 10);
        if (!isset($compras[$key])) $compras[$key] = $ins('INSERT INTO compras (proveedor_id, fecha, usuario_id) VALUES (?,?,?)', [$p['prov'], $entrada, $uid[0]]);
        $inicial = max($cant, round($p['min'] * 1.5));
        $ins('INSERT INTO compra_detalle (compra_id, producto_id, cantidad, costo) VALUES (?,?,?,?)', [$compras[$key], $p['id'], $inicial, $p['costo']]);
        $ins('INSERT INTO lotes (producto_id, proveedor_id, compra_id, cantidad, cantidad_inicial, fecha_entrada, fecha_caducidad) VALUES (?,?,?,?,?,?,?)',
            [$p['id'], $p['prov'], $compras[$key], $cant, $inicial, $entrada, $cad]);
    }
}
$pdo->exec('UPDATE compras c SET total = (SELECT COALESCE(SUM(cantidad * costo),0) FROM compra_detalle d WHERE d.compra_id = c.id)');

// Ventas históricas de 30 días (registros contables; no tocan los lotes actuales)
$nv = 0;
$horaActual = (int) date('G');
for ($d = 29; $d >= 0; $d--) {
    $fin = $d === 0 ? max(9, $horaActual) : 19;
    $dow = (int) (new DateTime('today'))->modify("-$d day")->format('w');
    $n = (int) round((($dow === 6 || $dow === 0) ? 11 : 7) + $r() * 6);
    if ($d === 0) $n = (int) ceil($n / 2);
    for ($v = 0; $v < $n; $v++) {
        $items = [];
        $usados = [];
        $k = 1 + (int) floor($r() * 4);
        for ($j = 0; $j < $k; $j++) {
            $p = $pid[(int) floor(($r() ** 1.6) * count($pid))];
            if (isset($usados[$p['id']])) continue;
            $usados[$p['id']] = true;
            $cant = $p['unidad'] === 'kg' ? round((0.5 + $r() * 2.5) * 2) / 2 : 1 + (int) floor($r() * 3);
            $items[] = [$p['id'], $p['nombre'], $p['unidad'], $cant, $p['precio']];
        }
        $total = array_sum(array_map(fn($x) => $x[3] * $x[4], $items));
        $enLinea = $r() < 0.22;
        $vid = $ins('INSERT INTO ventas (fecha, canal, cliente_id, metodo, total, usuario_id) VALUES (?,?,?,?,?,?)', [
            $dia(-$d, 8 + (int) floor($r() * max(1, $fin - 8)), (int) floor($r() * 60)), $enLinea ? 'en_linea' : 'mostrador',
            $enLinea ? $clientes[(int) floor($r() * count($clientes))] : null, $r() < 0.7 ? 'efectivo' : 'tarjeta', $total, $uid[0]]);
        $pdo->exec("UPDATE ventas SET folio = CONCAT('V-', 10000 + id) WHERE id = $vid");
        foreach ($items as $it) $ins('INSERT INTO venta_detalle (venta_id, producto_id, nombre, unidad, cantidad, precio) VALUES (?,?,?,?,?,?)', [$vid, ...$it]);
        $nv++;
    }
}

// Pedidos en línea en distintos estados
$ped = [
    [$uid[2], 0.4, 'pendiente', 'recoger', [[0, 3], [2, 1], [22, 0.5]], 'Naranja para jugo, por favor.'],
    [$uid[3], 1.2, 'pendiente', 'domicilio', [[6, 2], [5, 1.5], [16, 1]], ''],
    [$uid[1], 3, 'preparando', 'recoger', [[8, 2], [15, 1], [13, 1]], ''],
    [$uid[2], 5, 'listo', 'recoger', [[17, 2], [18, 1], [23, 2]], ''],
    [$uid[1], 52, 'entregado', 'domicilio', [[0, 4], [11, 3], [21, 1]], ''],
    [$uid[3], 75, 'entregado', 'recoger', [[4, 3], [12, 1]], ''],
    [$uid[1], 140, 'cancelado', 'recoger', [[14, 1]], 'Ya no lo necesito.'],
];
usort($ped, fn($a, $b) => $b[1] <=> $a[1]);
$flujo = ['pendiente' => ['pendiente'], 'preparando' => ['pendiente', 'preparando'], 'listo' => ['pendiente', 'preparando', 'listo'],
    'entregado' => ['pendiente', 'preparando', 'listo', 'entregado'], 'cancelado' => ['pendiente', 'cancelado']];
foreach ($ped as $o) {
    $fecha = (new DateTime())->modify('-' . (int) round($o[1] * 60) . ' minutes')->format('Y-m-d H:i:s');
    $total = array_sum(array_map(fn($x) => $x[1] * $pid[$x[0]]['precio'], $o[4]));
    $oid = $ins('INSERT INTO pedidos (cliente_id, fecha, estado, entrega, direccion, notas, total) VALUES (?,?,?,?,?,?,?)',
        [$o[0], $fecha, $o[2], $o[3], $o[3] === 'domicilio' ? 'Calle 41 #200 x 40 y 42, Centro' : null, $o[5] ?: null, $total]);
    $pdo->exec("UPDATE pedidos SET folio = CONCAT('PED-', 1000 + id) WHERE id = $oid");
    foreach ($o[4] as $x) { $p = $pid[$x[0]]; $ins('INSERT INTO pedido_detalle (pedido_id, producto_id, nombre, unidad, cantidad, precio) VALUES (?,?,?,?,?,?)', [$oid, $p['id'], $p['nombre'], $p['unidad'], $x[1], $p['precio']]); }
    foreach ($flujo[$o[2]] as $j => $e) $ins('INSERT INTO pedido_historial (pedido_id, estado, fecha) VALUES (?,?,?)', [$oid, $e, (new DateTime($fecha))->modify("+$j hour")->format('Y-m-d H:i:s')]);
    if ($o[2] === 'entregado') {
        $vid = $ins('INSERT INTO ventas (fecha, canal, cliente_id, pedido_id, metodo, total, usuario_id) VALUES (?,?,?,?,?,?,?)', [(new DateTime($fecha))->modify('+3 hour')->format('Y-m-d H:i:s'), 'en_linea', $o[0], $oid, 'efectivo', $total, $uid[0]]);
        $pdo->exec("UPDATE ventas SET folio = CONCAT('V-', 10000 + id) WHERE id = $vid");
        foreach ($o[4] as $x) { $p = $pid[$x[0]]; $ins('INSERT INTO venta_detalle (venta_id, producto_id, nombre, unidad, cantidad, precio) VALUES (?,?,?,?,?,?)', [$vid, $p['id'], $p['nombre'], $p['unidad'], $x[1], $p['precio']]); }
    }
}

$pdo->commit();
linea("✓ Datos de ejemplo: " . count($prods) . " productos ($fotos con foto), " . count($provs) . " proveedores, " . count($usuarios) . " usuarios, $nv ventas, " . count($ped) . " pedidos");
linea("  Cuentas demo: admin@reyesfruithub.demo / cliente@reyesfruithub.demo  (contraseña: demo123)");
