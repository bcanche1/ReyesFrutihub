<?php
/*
 * Enrutador para el servidor de desarrollo de PHP:
 *   php -S localhost:8080 servidor.php
 * Sirve los archivos estáticos y la API, y oculta lo que no debe ser público.
 */
$ruta = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

// Nada de configuración, núcleo, esquema, pruebas ni archivos ocultos por web
if (preg_match('#(^|/)\.|^/(database|tests|qa)(/|$)|^/api/(config|lib)\.php$|\.(md|sql|bat|ps1|log)$#i', $ruta) || $ruta === '/servidor.php') {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'No encontrado';
    return true;
}

// Cabeceras de seguridad básicas para las páginas
if (preg_match('#\.html?$|/$#', $ruta)) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}

if ($ruta === '/api' || $ruta === '/api/') { require __DIR__ . '/api/index.php'; return true; }
return false; // que el servidor integrado entregue el archivo tal cual
