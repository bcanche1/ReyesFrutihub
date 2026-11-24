<?php
/*
 * ReyesFruitHub · configuración de conexión.
 * Orden de prioridad para cada dato:
 *   1. Variable de entorno del sistema (DB_USER, DB_PASS, ...; las pruebas usan RFH_DB para su base aparte)
 *   2. Archivo .env en la raíz del proyecto (ver .env.example)
 * Las credenciales viven solo en .env: no se escriben en el código.
 */

if (!function_exists('rfh_leer_env')) {
function rfh_leer_env(string $ruta): array
{
    $vars = [];
    if (!is_readable($ruta)) return $vars;
    foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
        $linea = trim($linea);
        if ($linea === '' || $linea[0] === '#' || !str_contains($linea, '=')) continue;
        [$k, $v] = array_map('trim', explode('=', $linea, 2));
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) $v = substr($v, 1, -1); // quita comillas
        $vars[$k] = $v;
    }
    return $vars;
}
}

$env = rfh_leer_env(__DIR__ . '/../.env');
$dato = function (string $k, ?string $porDefecto = null) use ($env): ?string {
    $sistema = getenv($k);
    if ($sistema !== false) return $sistema;
    return $env[$k] ?? $porDefecto;
};

$cfg = [
    'db_host' => $dato('DB_HOST', '127.0.0.1'),
    'db_port' => $dato('DB_PORT', '3306'),
    'db_name' => getenv('RFH_DB') ?: $dato('DB_NAME', 'reyesfruithub'),
    'db_user' => $dato('DB_USER'),
    'db_pass' => $dato('DB_PASS', ''),
    'zona'    => 'America/Merida',
];

if (!$cfg['db_user']) {
    $msg = 'Falta configurar la base de datos: copia .env.example como .env y escribe DB_USER y DB_PASS.';
    if (PHP_SAPI === 'cli') { fwrite(STDERR, "✗ $msg\n"); exit(1); }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

return $cfg;
