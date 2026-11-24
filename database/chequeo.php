<?php
/*
 * ReyesFruitHub · chequeo de la base de datos (solo línea de comandos)
 *   php database/chequeo.php
 * Revisa conexión, estructura, integridad de los datos y seguridad.
 * Sale con código 1 si algún chequeo FALLA (✗). Las advertencias (⚠) no fallan.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../api/lib.php';

$fallos = 0; $avisos = 0; $oks = 0;
function ok(string $m): void { global $oks; $oks++; echo "  ✓ $m\n"; }
function mal(string $m): void { global $fallos; $fallos++; echo "  ✗ $m\n"; }
function aviso(string $m): void { global $avisos; $avisos++; echo "  ⚠ $m\n"; }
function check(bool $cond, string $m, bool $soloAviso = false): void { $cond ? ok($m) : ($soloAviso ? aviso($m) : mal($m)); }
function seccion(string $t): void { echo "\n$t\n"; }
function cero(string $sql, string $desc): void { $n = (int) qval($sql); check($n === 0, $n === 0 ? $desc : "$desc → $n con problema"); }

$cfg = $GLOBALS['RFH_CFG'];
echo "ReyesFruitHub · chequeo de base de datos · " . date('Y-m-d H:i') . "\n";

seccion('1. Conexión');
try { db(); ok("Conectado a {$cfg['db_host']}:{$cfg['db_port']} como {$cfg['db_user']}"); }
catch (PDOException $e) { mal('No se pudo conectar: ' . $e->getMessage()); echo "\nResultado: 1 fallo\n"; exit(1); }
$ver = (string) qval('SELECT VERSION()');
$esMaria = stripos($ver, 'mariadb') !== false;
preg_match('/^(\d+)\.(\d+)/', $ver, $m);
$vOk = $esMaria ? version_compare("$m[1].$m[2]", '10.2', '>=') : version_compare("$m[1].$m[2]", '8.0', '>=');
check($vOk, "Versión del servidor $ver (" . ($esMaria ? 'MariaDB ≥ 10.2' : 'MySQL ≥ 8.0') . ' para que se apliquen los CHECK)');
check(qval('SELECT DATABASE()') === $cfg['db_name'], "Base en uso: {$cfg['db_name']}");
$charset = qval('SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()');
check($charset === 'utf8mb4', "Juego de caracteres $charset (acentos, ñ y emoji)");
$t0 = microtime(true); qval('SELECT COUNT(*) FROM v_existencias'); $ms = round((microtime(true) - $t0) * 1000, 1);
check($ms < 200, "Consulta de existencias en $ms ms", true);

seccion('2. Estructura');
$esperadas = ['usuarios', 'categorias', 'proveedores', 'proveedor_categoria', 'productos', 'compras', 'compra_detalle', 'lotes', 'pedidos', 'pedido_detalle', 'pedido_historial', 'ventas', 'venta_detalle', 'mermas'];
$tablas = array_column(qall("SELECT TABLE_NAME, ENGINE, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"), null, 'TABLE_NAME');
$faltan = array_diff($esperadas, array_keys($tablas));
check(!$faltan, $faltan ? 'Faltan tablas: ' . implode(', ', $faltan) : count($esperadas) . ' tablas presentes');
check(isset($tablas['v_existencias']) && $tablas['v_existencias']['TABLE_TYPE'] === 'VIEW', 'Vista v_existencias presente');
$noInno = array_filter($tablas, fn($t) => $t['TABLE_TYPE'] === 'BASE TABLE' && $t['ENGINE'] !== 'InnoDB');
check(!$noInno, $noInno ? 'Tablas sin InnoDB: ' . implode(', ', array_keys($noInno)) : 'Todas las tablas usan InnoDB (transacciones y llaves foráneas)');
$fks = (int) qval('SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()');
check($fks >= 20, "$fks llaves foráneas definidas");
$checks = (int) qval('SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()');
check($checks >= 8, "$checks restricciones CHECK (precios > 0, cantidades ≥ 0, …)");
foreach (['lotes' => 'ix_lotes_peps', 'ventas' => 'ix_ventas_fecha', 'usuarios' => 'uq_usuarios_email', 'pedidos' => 'uq_pedidos_folio', 'ventas ' => 'uq_ventas_pedido'] as $t => $ix)
    check((bool) qval('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [trim($t), $ix]), "Índice $ix en " . trim($t));

seccion('3. Integridad de los datos');
cero('SELECT COUNT(*) FROM lotes WHERE cantidad < 0 OR cantidad > cantidad_inicial', 'Lotes con cantidades válidas');
cero('SELECT COUNT(*) FROM lotes WHERE fecha_caducidad < fecha_entrada', 'Caducidad posterior a la entrada en todos los lotes');
cero('SELECT COUNT(*) FROM pedidos p WHERE ABS(p.total - (SELECT COALESCE(SUM(cantidad*precio),0) FROM pedido_detalle d WHERE d.pedido_id = p.id)) > 0.01', 'Total de cada pedido = suma de su detalle');
cero('SELECT COUNT(*) FROM ventas v WHERE ABS(v.total - (SELECT COALESCE(SUM(cantidad*precio),0) FROM venta_detalle d WHERE d.venta_id = v.id)) > 0.01', 'Total de cada venta = suma de su detalle');
cero('SELECT COUNT(*) FROM compras c WHERE ABS(c.total - (SELECT COALESCE(SUM(cantidad*costo),0) FROM compra_detalle d WHERE d.compra_id = c.id)) > 0.01', 'Total de cada compra = suma de su detalle');
cero('SELECT COUNT(*) FROM pedidos p WHERE NOT EXISTS (SELECT 1 FROM pedido_detalle d WHERE d.pedido_id = p.id)', 'Ningún pedido vacío');
cero('SELECT COUNT(*) FROM ventas v WHERE NOT EXISTS (SELECT 1 FROM venta_detalle d WHERE d.venta_id = v.id)', 'Ninguna venta vacía');
cero('SELECT COUNT(*) FROM pedidos WHERE folio IS NULL', 'Todos los pedidos tienen folio');
cero('SELECT COUNT(*) FROM ventas WHERE folio IS NULL', 'Todas las ventas tienen folio');
cero("SELECT COUNT(*) FROM pedidos p WHERE p.estado = 'entregado' AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.pedido_id = p.id)", 'Cada pedido entregado generó su venta');
cero("SELECT COUNT(*) FROM ventas v JOIN pedidos p ON p.id = v.pedido_id WHERE p.estado <> 'entregado'", 'Ninguna venta de un pedido no entregado');
cero("SELECT COUNT(*) FROM ventas WHERE canal = 'en_linea' AND cliente_id IS NULL AND pedido_id IS NOT NULL", 'Ventas en línea con cliente');
cero('SELECT COUNT(*) FROM pedidos p WHERE p.estado <> (SELECT h.estado FROM pedido_historial h WHERE h.pedido_id = p.id ORDER BY h.fecha DESC, h.id DESC LIMIT 1)', 'Historial de cada pedido termina en su estado actual');
cero("SELECT COUNT(*) FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE u.rol <> 'cliente'", 'Los pedidos pertenecen a clientes');
cero('SELECT COUNT(*) FROM productos WHERE costo > precio', 'Ningún producto se vende por debajo de su costo');
$neg = qall("SELECT p.nombre, e.stock, (SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalle d JOIN pedidos o ON o.id=d.pedido_id WHERE d.producto_id=p.id AND o.estado IN ('pendiente','preparando','listo')) AS reservado
             FROM productos p JOIN v_existencias e ON e.producto_id = p.id HAVING reservado > stock");
check(!$neg, $neg ? 'Pedidos activos que superan la existencia: ' . implode(', ', array_map(fn($r) => "{$r['nombre']} (hay {$r['stock']}, apartado {$r['reservado']})", $neg)) : 'Lo apartado en pedidos no supera la existencia', true);
$cad = (int) qval('SELECT COUNT(*) FROM lotes WHERE cantidad > 0 AND fecha_caducidad < NOW()');
check($cad === 0, $cad ? "$cad lotes caducados con existencia (registrar merma)" : 'Sin lotes caducados con existencia', true);

seccion('4. Seguridad');
$usuarios = qall('SELECT email, password_hash, rol, activo FROM usuarios');
$sinHash = array_filter($usuarios, fn($u) => (password_get_info($u['password_hash'])['algo'] ?? null) === null);
check(!$sinHash, $sinHash ? count($sinHash) . ' contraseñas SIN hash: ' . implode(', ', array_column($sinHash, 'email')) : count($usuarios) . ' contraseñas guardadas con hash (' . password_get_info($usuarios[0]['password_hash'] ?? '')['algoName'] . ')');
check((bool) array_filter($usuarios, fn($u) => $u['rol'] === 'admin' && (int) $u['activo']), 'Existe al menos un administrador activo');
$dup = (int) qval('SELECT COUNT(*) FROM (SELECT LOWER(email) e FROM usuarios GROUP BY e HAVING COUNT(*) > 1) x');
check($dup === 0, 'Correos únicos (sin distinguir mayúsculas)');
$demo = array_filter($usuarios, fn($u) => password_verify('demo123', $u['password_hash']));
check(!$demo, $demo ? count($demo) . ' cuentas aún usan la contraseña demo «demo123» (cámbialas antes de publicar)' : 'Ninguna cuenta usa la contraseña demo', true);
check($cfg['db_user'] !== 'root', $cfg['db_user'] === 'root' ? 'La app se conecta como root: para publicar crea un usuario solo con permisos sobre esta base' : 'La app no usa root', true);
check($cfg['db_pass'] !== '', 'El usuario de la base tiene contraseña');
$grants = array_map(fn($r) => (string) array_values($r)[0], qall('SHOW GRANTS FOR CURRENT_USER()'));
$globales = array_filter($grants, fn($g) => preg_match('/ON \*\.\*/', $g) && !preg_match('/^GRANT USAGE ON/', $g));
check(!$globales, $globales ? 'El usuario tiene permisos sobre TODO el servidor (*.*): limítalos a esta base' : "Permisos de {$cfg['db_user']} limitados a bases específicas (sin permisos globales)", true);
check((bool) array_filter($grants, fn($g) => str_contains($g, "`{$cfg['db_name']}`") || str_contains($g, '`' . str_replace('_', '\\_', $cfg['db_name']) . '`')), "{$cfg['db_user']} tiene permisos sobre la base {$cfg['db_name']}");
check(is_file(__DIR__ . '/../.env'), 'Credenciales en .env (fuera del código)', true);
$sm = (string) qval('SELECT @@SESSION.sql_mode');
check(str_contains($sm, 'STRICT_TRANS_TABLES') || str_contains($sm, 'STRICT_ALL_TABLES'), "Modo estricto de SQL activo (rechaza datos inválidos en lugar de recortarlos)", true);

echo "\nResultado: $oks correctos, $avisos advertencias, $fallos fallos\n";
exit($fallos ? 1 : 0);
