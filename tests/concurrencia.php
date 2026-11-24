<?php
/*
 * Prueba de concurrencia real: N procesos PHP intentan vender a la vez la ÚLTIMA unidad de un producto.
 * Gracias a SELECT ... FOR UPDATE dentro de la transacción, solo uno debe lograrlo.
 *   php tests/concurrencia.php            (orquestador, usa la base de RFH_DB)
 *   php tests/concurrencia.php hijo <id>  (lo invoca el orquestador)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../api/lib.php';

if (($argv[1] ?? '') === 'hijo') {
    $pid = (int) $argv[2];
    $inicio = (float) $argv[3];
    while (microtime(true) < $inicio) usleep(500);      // todos arrancan al mismo instante
    try {
        tx(function () use ($pid) {
            $items = preparar_items([['productoId' => $pid, 'cantidad' => 1]], false);
            usleep(150000);                              // ventana de carrera: 150 ms dentro de la transacción
            registrar_venta($items, 'mostrador', null, null, 'efectivo', null);
        });
        echo "OK\n";
    } catch (ApiError $e) { echo "RECHAZADA\n"; }
    exit;
}

// Orquestador: producto en pieza con existencia, dejarlo en exactamente 1
$p = q1("SELECT p.id, p.nombre, e.stock FROM productos p JOIN v_existencias e ON e.producto_id = p.id WHERE p.unidad = 'pieza' AND e.stock >= 2 ORDER BY p.id LIMIT 1");
if (!$p) { echo "✗ No hay producto adecuado para la prueba\n"; exit(1); }
tx(function () use ($p) { $items = preparar_items([['productoId' => (int) $p['id'], 'cantidad' => (float) $p['stock'] - 1]], false); registrar_venta($items, 'mostrador', null, null, 'efectivo', null); });

$n = 4;
$inicio = microtime(true) + 1.0;
$procs = [];
for ($i = 0; $i < $n; $i++) {
    $procs[] = proc_open([PHP_BINARY, __FILE__, 'hijo', (string) $p['id'], (string) $inicio], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes[$i]);
}
$res = [];
foreach ($procs as $i => $proc) { $res[] = trim(stream_get_contents($pipes[$i][1])); fclose($pipes[$i][1]); fclose($pipes[$i][2]); proc_close($proc); }
$okN = count(array_filter($res, fn($r) => $r === 'OK'));
$stock = (float) qval('SELECT stock FROM v_existencias WHERE producto_id = ?', [$p['id']]);
echo "  $n procesos intentaron vender la última pieza de {$p['nombre']}: " . implode(', ', $res) . "\n";
if ($okN === 1 && $stock == 0.0) { echo "  ✓ Solo una venta pasó y la existencia quedó en 0\n"; exit(0); }
echo "  ✗ Ventas aceptadas: $okN, existencia final: $stock\n";
exit(1);
