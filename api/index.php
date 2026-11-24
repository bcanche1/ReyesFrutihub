<?php
/*
 * ReyesFruitHub · API JSON
 *   GET  api/?accion=datos      → todo lo que el usuario actual puede ver (según su rol)
 *   GET  api/?accion=estado     → chequeo de conexión
 *   POST api/?accion=<accion>   → cuerpo JSON; requiere cabecera X-RFH: 1 (defensa CSRF)
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');

/* ================= Salidas ================= */
function usuario_out(array $u): array
{
    return ['id' => (string) $u['id'], 'nombre' => $u['nombre'], 'email' => $u['email'], 'rol' => $u['rol'],
        'telefono' => $u['telefono'] ?? '', 'direccion' => $u['direccion'] ?? '', 'activo' => (bool) $u['activo'], 'creado' => iso($u['creado'])];
}

function productos_out(bool $admin): array
{
    $rows = qall("SELECT p.*, e.stock, e.proxima_caducidad, e.lotes,
                   (SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalle d JOIN pedidos o ON o.id = d.pedido_id
                     WHERE d.producto_id = p.id AND o.estado IN ('pendiente','preparando','listo')) AS reservado
                  FROM productos p JOIN v_existencias e ON e.producto_id = p.id " . ($admin ? '' : 'WHERE p.activo = 1') . ' ORDER BY p.nombre');
    return array_map(function ($p) use ($admin) {
        $o = ['id' => (string) $p['id'], 'nombre' => $p['nombre'], 'categoria' => $p['categoria_id'], 'unidad' => $p['unidad'],
            'precio' => f($p['precio']), 'stockMinimo' => f($p['stock_minimo']), 'imagen' => $p['imagen'], 'forma' => $p['forma'],
            'color' => $p['color'], 'fondo' => $p['fondo'], 'destacado' => (bool) $p['destacado'], 'activo' => (bool) $p['activo'],
            'descripcion' => $p['descripcion'] ?? '', 'stock' => f($p['stock']), 'reservado' => f($p['reservado']),
            'proximaCaducidad' => iso($p['proxima_caducidad']), 'lotes' => (int) $p['lotes']];
        if ($admin) $o += ['costo' => f($p['costo']), 'vidaDias' => (int) $p['vida_dias'], 'proveedorId' => $p['proveedor_id'] ? (string) $p['proveedor_id'] : ''];
        return $o;
    }, $rows);
}

function items_de(string $tabla, string $fk, array $ids): array
{
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $g = [];
    foreach (qall("SELECT * FROM $tabla WHERE $fk IN ($in) ORDER BY id", $ids) as $r) {
        $g[$r[$fk]][] = ['productoId' => (string) $r['producto_id'], 'nombre' => $r['nombre'], 'unidad' => $r['unidad'], 'cantidad' => f($r['cantidad']), 'precio' => f($r['precio'])];
    }
    return $g;
}

function pedidos_out(string $where, array $p): array
{
    $rows = qall("SELECT * FROM pedidos $where ORDER BY fecha DESC, id DESC LIMIT 300", $p);
    $ids = array_column($rows, 'id');
    $items = items_de('pedido_detalle', 'pedido_id', $ids);
    $hist = [];
    if ($ids) foreach (qall('SELECT * FROM pedido_historial WHERE pedido_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY fecha, id', $ids) as $h)
        $hist[$h['pedido_id']][] = ['estado' => $h['estado'], 'fecha' => iso($h['fecha'])];
    return array_map(fn($o) => ['id' => $o['folio'], 'clienteId' => (string) $o['cliente_id'], 'fecha' => iso($o['fecha']), 'estado' => $o['estado'],
        'entrega' => $o['entrega'], 'direccion' => $o['direccion'] ?? '', 'notas' => $o['notas'] ?? '', 'total' => f($o['total']),
        'items' => $items[$o['id']] ?? [], 'historial' => $hist[$o['id']] ?? []], $rows);
}

function datos(): array
{
    $u = usuario_actual();
    $admin = $u && $u['rol'] === 'admin';
    $out = [
        'usuario'    => $u ? usuario_out($u) : null,
        'categorias' => qall("SELECT id, nombre FROM categorias ORDER BY FIELD(id,'citricos','tropicales','frutas','verduras','hierbas'), nombre"),
        'productos'  => productos_out($admin),
        'pedidos' => [], 'proveedores' => [], 'lotes' => [], 'compras' => [], 'ventas' => [], 'usuarios' => [], 'mermas' => [],
    ];
    if ($u && $u['rol'] === 'cliente') $out['pedidos'] = pedidos_out('WHERE cliente_id = ?', [$u['id']]);
    if (!$admin) return $out;

    $out['pedidos'] = pedidos_out('', []);
    $cats = [];
    foreach (qall('SELECT * FROM proveedor_categoria') as $r) $cats[$r['proveedor_id']][] = $r['categoria_id'];
    $out['proveedores'] = array_map(fn($p) => ['id' => (string) $p['id'], 'nombre' => $p['nombre'], 'contacto' => $p['contacto'] ?? '', 'telefono' => $p['telefono'],
        'email' => $p['email'] ?? '', 'diasEntrega' => $p['dias_entrega'] ?? '', 'activo' => (bool) $p['activo'], 'notas' => $p['notas'] ?? '',
        'categorias' => $cats[$p['id']] ?? []], qall('SELECT * FROM proveedores ORDER BY nombre'));
    $out['lotes'] = array_map(fn($l) => ['id' => (string) $l['id'], 'productoId' => (string) $l['producto_id'], 'cantidad' => f($l['cantidad']),
        'cantidadInicial' => f($l['cantidad_inicial']), 'entrada' => iso($l['fecha_entrada']), 'caducidad' => iso($l['fecha_caducidad']),
        'proveedorId' => (string) $l['proveedor_id']], qall('SELECT * FROM lotes WHERE cantidad > 0 ORDER BY fecha_caducidad'));

    $compras = qall('SELECT * FROM compras ORDER BY fecha DESC, id DESC LIMIT 60');
    $cd = [];
    if ($compras) foreach (qall('SELECT * FROM compra_detalle WHERE compra_id IN (' . implode(',', array_column($compras, 'id')) . ')') as $r)
        $cd[$r['compra_id']][] = ['productoId' => (string) $r['producto_id'], 'cantidad' => f($r['cantidad']), 'costo' => f($r['costo'])];
    $out['compras'] = array_map(fn($c) => ['id' => (string) $c['id'], 'proveedorId' => (string) $c['proveedor_id'], 'fecha' => iso($c['fecha']),
        'total' => f($c['total']), 'estado' => $c['estado'], 'items' => $cd[$c['id']] ?? []], $compras);

    $ventas = qall('SELECT * FROM ventas WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY fecha DESC, id DESC');
    $vi = items_de('venta_detalle', 'venta_id', array_column($ventas, 'id'));
    $out['ventas'] = array_map(fn($v) => ['id' => $v['folio'], 'fecha' => iso($v['fecha']), 'canal' => $v['canal'], 'clienteId' => $v['cliente_id'] ? (string) $v['cliente_id'] : null,
        'metodo' => $v['metodo'], 'total' => f($v['total']), 'items' => $vi[$v['id']] ?? []], $ventas);

    $out['usuarios'] = array_map('usuario_out', qall('SELECT * FROM usuarios ORDER BY rol, nombre'));
    $out['mermas'] = array_map(fn($m) => ['id' => (string) $m['id'], 'productoId' => (string) $m['producto_id'], 'cantidad' => f($m['cantidad']),
        'motivo' => $m['motivo'], 'fecha' => iso($m['fecha'])], qall('SELECT * FROM mermas ORDER BY fecha DESC LIMIT 50'));
    return $out;
}

function estado(): array
{
    $ok = (int) qval('SELECT 1') === 1;
    $u = usuario_actual();
    $r = ['conexion' => $ok ? 'ok' : 'error'];
    if ($u && $u['rol'] === 'admin') {
        $r['servidor'] = qval('SELECT VERSION()');
        $r['base'] = qval('SELECT DATABASE()');
        foreach (['usuarios', 'productos', 'lotes', 'pedidos', 'ventas', 'proveedores'] as $t) $r['registros'][$t] = (int) qval("SELECT COUNT(*) FROM $t");
    }
    return $r;
}

/* ================= Acciones ================= */
const TRANSICIONES = ['pendiente' => ['preparando', 'cancelado'], 'preparando' => ['listo', 'cancelado'], 'listo' => ['entregado', 'cancelado']];

$POST = [
    'login' => function (array $in): array {
        $_SESSION['intentos'] ??= 0;
        if (($_SESSION['bloqueo'] ?? 0) > time()) fail('Demasiados intentos. Espera un minuto e inténtalo de nuevo.', 429);
        $email = mb_strtolower(txt($in, 'email', 160, true, 'el correo'));
        $pass = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
        $u = q1('SELECT * FROM usuarios WHERE email = ?', [$email]);
        if (!$u || !password_verify($pass, $u['password_hash'])) {
            if (++$_SESSION['intentos'] >= 5) { $_SESSION['bloqueo'] = time() + 60; $_SESSION['intentos'] = 0; }
            fail('Correo o contraseña incorrectos.', 401);
        }
        if (!(int) $u['activo']) fail('Tu cuenta está desactivada. Habla con la frutería.', 403);
        session_regenerate_id(true);
        $_SESSION = ['uid' => (int) $u['id']];
        return ['usuario' => usuario_out($u)];
    },

    'registro' => function (array $in): array {
        $nombre = txt($in, 'nombre', 120, true, 'el nombre');
        $email = mb_strtolower(txt($in, 'email', 160, true, 'el correo'));
        $tel = txt($in, 'telefono', 20);
        $pass = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
        if (mb_strlen($nombre) < 3) fail('Escribe tu nombre (mínimo 3 letras).', 422);
        if (!email_ok($email)) fail('Escribe un correo válido.', 422);
        if (!tel_ok($tel)) fail('El teléfono debe tener 10 dígitos.', 422);
        if (mb_strlen($pass) < 8) fail('La contraseña necesita al menos 8 caracteres.', 422);
        if (q1('SELECT id FROM usuarios WHERE email = ?', [$email])) fail('Ya existe una cuenta con ese correo.', 409);
        q('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES (?,?,?,?,?)', [$nombre, $email, password_hash($pass, PASSWORD_DEFAULT), 'cliente', $tel]);
        session_regenerate_id(true);
        $_SESSION = ['uid' => last_id()];
        return ['usuario' => usuario_out(q1('SELECT * FROM usuarios WHERE id = ?', [$_SESSION['uid']]))];
    },

    'salir' => function (): array {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
        session_destroy();
        return [];
    },

    'perfil' => function (array $in): array {
        $u = requerir('admin', 'cliente');
        $nombre = txt($in, 'nombre', 120, true, 'el nombre');
        $tel = txt($in, 'telefono', 20);
        if (mb_strlen($nombre) < 3) fail('Escribe tu nombre.', 422);
        if (!tel_ok($tel)) fail('El teléfono debe tener 10 dígitos.', 422);
        q('UPDATE usuarios SET nombre = ?, telefono = ?, direccion = ? WHERE id = ?', [$nombre, $tel, txt($in, 'direccion', 255), $u['id']]);
        return [];
    },

    'pedido_crear' => function (array $in): array {
        $u = requerir('cliente');
        $entrega = ($in['entrega'] ?? '') === 'domicilio' ? 'domicilio' : 'recoger';
        $dir = txt($in, 'direccion', 255);
        if ($entrega === 'domicilio' && mb_strlen((string) $dir) < 8) fail('Escribe la dirección completa para poder llevar tu pedido.', 422);
        $notas = txt($in, 'notas', 500);
        return tx(function () use ($u, $in, $entrega, $dir, $notas) {
            $items = preparar_items($in['items'] ?? null, true);
            q('INSERT INTO pedidos (cliente_id, estado, entrega, direccion, notas, total) VALUES (?,?,?,?,?,?)',
                [$u['id'], 'pendiente', $entrega, $entrega === 'domicilio' ? $dir : null, $notas, total_items($items)]);
            $id = last_id();
            $folio = 'PED-' . (1000 + $id);
            q('UPDATE pedidos SET folio = ? WHERE id = ?', [$folio, $id]);
            $st = db()->prepare('INSERT INTO pedido_detalle (pedido_id, producto_id, nombre, unidad, cantidad, precio) VALUES (?,?,?,?,?,?)');
            foreach ($items as $i) $st->execute([$id, $i['producto_id'], $i['nombre'], $i['unidad'], $i['cantidad'], $i['precio']]);
            q('INSERT INTO pedido_historial (pedido_id, estado, usuario_id) VALUES (?,?,?)', [$id, 'pendiente', $u['id']]);
            return ['id' => $folio, 'total' => total_items($items)];
        });
    },

    'pedido_estado' => function (array $in): array {
        $u = requerir('admin', 'cliente');
        $folio = txt($in, 'id', 20, true, 'el pedido');
        $nuevo = (string) ($in['estado'] ?? '');
        return tx(function () use ($u, $folio, $nuevo) {
            $o = q1('SELECT * FROM pedidos WHERE folio = ? FOR UPDATE', [$folio]);
            if (!$o) fail('El pedido no existe.', 404);
            if ($u['rol'] === 'cliente') {   // el cliente solo puede cancelar SUS pedidos aún no preparados
                if ((int) $o['cliente_id'] !== (int) $u['id']) fail('El pedido no existe.', 404);
                if ($nuevo !== 'cancelado' || $o['estado'] !== 'pendiente') fail('Este pedido ya no se puede cancelar.', 409);
            }
            if (!in_array($nuevo, TRANSICIONES[$o['estado']] ?? [], true)) fail("No se puede pasar de «{$o['estado']}» a «{$nuevo}».", 409);
            if ($nuevo === 'entregado') {
                $items = array_map(fn($d) => ['producto_id' => (int) $d['producto_id'], 'nombre' => $d['nombre'], 'unidad' => $d['unidad'], 'cantidad' => f($d['cantidad']), 'precio' => f($d['precio'])],
                    qall('SELECT * FROM pedido_detalle WHERE pedido_id = ?', [$o['id']]));
                foreach ($items as $i) producto_bloqueado($i['producto_id']);
                registrar_venta($items, 'en_linea', (int) $o['cliente_id'], (int) $o['id'], 'efectivo', (int) $u['id']);
            }
            q('UPDATE pedidos SET estado = ? WHERE id = ?', [$nuevo, $o['id']]);
            q('INSERT INTO pedido_historial (pedido_id, estado, usuario_id) VALUES (?,?,?)', [$o['id'], $nuevo, $u['id']]);
            return ['id' => $folio, 'estado' => $nuevo];
        });
    },

    'venta_registrar' => function (array $in): array {
        $u = requerir('admin');
        $metodo = ($in['metodo'] ?? '') === 'tarjeta' ? 'tarjeta' : 'efectivo';
        return tx(fn() => registrar_venta(preparar_items($in['items'] ?? null, false), 'mostrador', null, null, $metodo, (int) $u['id']));
    },

    'producto_guardar' => function (array $in): array {
        requerir('admin');
        $id = isset($in['id']) && $in['id'] !== '' ? ident($in, 'id') : null;
        $nombre = txt($in, 'nombre', 80, true, 'el nombre');
        if (mb_strlen($nombre) < 2) fail('Escribe el nombre del producto.', 422);
        $cat = (string) ($in['categoria'] ?? '');
        if (!q1('SELECT id FROM categorias WHERE id = ?', [$cat])) fail('Elige una categoría válida.', 422);
        $unidad = in_array($in['unidad'] ?? '', ['kg', 'pieza', 'manojo'], true) ? $in['unidad'] : fail('Elige la unidad de venta.', 422);
        $precio = num($in, 'precio', 'El precio');
        $costo = num($in, 'costo', 'El costo', 0, false);
        if ($costo > $precio) fail('El costo es mayor que el precio: venderías con pérdida.', 422);
        $min = num($in, 'stockMinimo', 'La existencia mínima', 0, false);
        $vida = (int) num($in, 'vidaDias', 'La vida de anaquel');
        $prov = isset($in['proveedorId']) && $in['proveedorId'] !== '' ? ident($in, 'proveedorId', 'el proveedor') : null;
        if ($prov && !q1('SELECT id FROM proveedores WHERE id = ?', [$prov])) fail('El proveedor no existe.', 422);
        $img = txt($in, 'imagen', 255);
        if ($img !== null && !preg_match('#^(assets/img/[\w\-/]+\.(jpe?g|png|webp)|https://[^\s"<>]+)$#i', $img)) fail('La imagen debe ser una ruta de assets/img/ o una URL https.', 422);
        $dup = q1('SELECT id FROM productos WHERE nombre = ? AND id <> ?', [$nombre, $id ?? 0]);
        if ($dup) fail('Ya existe un producto con ese nombre.', 409);
        $vals = [$nombre, $cat, $unidad, $precio, $costo, $min, $vida, $prov, $img, !empty($in['activo']) ? 1 : 0, !empty($in['destacado']) ? 1 : 0];
        if ($id) {
            if (!q1('SELECT id FROM productos WHERE id = ?', [$id])) fail('El producto no existe.', 404);
            q('UPDATE productos SET nombre=?, categoria_id=?, unidad=?, precio=?, costo=?, stock_minimo=?, vida_dias=?, proveedor_id=?, imagen=?, activo=?, destacado=? WHERE id=?', [...$vals, $id]);
        } else {
            q('INSERT INTO productos (nombre, categoria_id, unidad, precio, costo, stock_minimo, vida_dias, proveedor_id, imagen, activo, destacado) VALUES (?,?,?,?,?,?,?,?,?,?,?)', $vals);
            $id = last_id();
        }
        return ['id' => (string) $id];
    },

    'producto_eliminar' => function (array $in): array {
        requerir('admin');
        $id = ident($in, 'id');
        try { q('DELETE FROM productos WHERE id = ?', [$id]); }
        catch (PDOException $e) {
            if ($e->getCode() === '23000') fail('Este producto tiene historial (lotes, ventas o pedidos). Mejor márcalo como oculto.', 409);
            throw $e;
        }
        return [];
    },

    'entrada_registrar' => function (array $in): array {
        $u = requerir('admin');
        $pid = ident($in, 'productoId', 'el producto');
        $cant = num($in, 'cantidad', 'La cantidad');
        $costo = num($in, 'costo', 'El costo', 0, false);
        $prov = ident($in, 'proveedorId', 'el proveedor');
        $cad = DateTime::createFromFormat('Y-m-d', substr((string) ($in['caducidad'] ?? ''), 0, 10));
        if (!$cad) fail('Indica la fecha de caducidad.', 422);
        $cad->setTime(20, 0);
        if ($cad < new DateTime('today')) fail('La caducidad no puede ser una fecha pasada.', 422);
        return tx(function () use ($u, $pid, $cant, $costo, $prov, $cad) {
            producto_bloqueado($pid);
            if (!q1('SELECT id FROM proveedores WHERE id = ?', [$prov])) fail('El proveedor no existe.', 422);
            q('INSERT INTO compras (proveedor_id, total, usuario_id) VALUES (?,?,?)', [$prov, f($cant * $costo), $u['id']]);
            $cid = last_id();
            q('INSERT INTO compra_detalle (compra_id, producto_id, cantidad, costo) VALUES (?,?,?,?)', [$cid, $pid, $cant, $costo]);
            q('INSERT INTO lotes (producto_id, proveedor_id, compra_id, cantidad, cantidad_inicial, fecha_caducidad) VALUES (?,?,?,?,?,?)', [$pid, $prov, $cid, $cant, $cant, $cad->format('Y-m-d H:i:s')]);
            return ['lote' => (string) last_id()];
        });
    },

    'merma_registrar' => function (array $in): array {
        $u = requerir('admin');
        $pid = ident($in, 'productoId', 'el producto');
        $cant = num($in, 'cantidad', 'La cantidad');
        $motivo = txt($in, 'motivo', 80, true, 'el motivo');
        return tx(function () use ($u, $pid, $cant, $motivo) {
            $p = producto_bloqueado($pid);
            consumir($pid, $cant, $p['nombre']);
            q('INSERT INTO mermas (producto_id, cantidad, motivo, usuario_id) VALUES (?,?,?,?)', [$pid, $cant, $motivo, $u['id']]);
            return [];
        });
    },

    'proveedor_guardar' => function (array $in): array {
        requerir('admin');
        $id = isset($in['id']) && $in['id'] !== '' ? ident($in, 'id') : null;
        $nombre = txt($in, 'nombre', 120, true, 'el nombre');
        $tel = txt($in, 'telefono', 20, true, 'el teléfono');
        $email = txt($in, 'email', 160);
        if (mb_strlen($nombre) < 3) fail('Escribe el nombre del proveedor.', 422);
        if (!tel_ok($tel)) fail('El teléfono debe tener 10 dígitos.', 422);
        if ($email !== null && !email_ok($email)) fail('Revisa el correo.', 422);
        $cats = array_values(array_filter((array) ($in['categorias'] ?? []), fn($c) => is_string($c) && q1('SELECT id FROM categorias WHERE id = ?', [$c])));
        return tx(function () use ($id, $nombre, $tel, $email, $in, $cats) {
            $vals = [$nombre, txt($in, 'contacto', 120), $tel, $email, txt($in, 'diasEntrega', 80), !empty($in['activo']) ? 1 : 0, txt($in, 'notas', 1000)];
            if ($id) {
                if (!q1('SELECT id FROM proveedores WHERE id = ?', [$id])) fail('El proveedor no existe.', 404);
                q('UPDATE proveedores SET nombre=?, contacto=?, telefono=?, email=?, dias_entrega=?, activo=?, notas=? WHERE id=?', [...$vals, $id]);
            } else {
                q('INSERT INTO proveedores (nombre, contacto, telefono, email, dias_entrega, activo, notas) VALUES (?,?,?,?,?,?,?)', $vals);
                $id = last_id();
            }
            q('DELETE FROM proveedor_categoria WHERE proveedor_id = ?', [$id]);
            foreach ($cats as $c) q('INSERT INTO proveedor_categoria (proveedor_id, categoria_id) VALUES (?,?)', [$id, $c]);
            return ['id' => (string) $id];
        });
    },

    'usuario_guardar' => function (array $in): array {
        $yo = requerir('admin');
        $id = isset($in['id']) && $in['id'] !== '' ? ident($in, 'id') : null;
        $nombre = txt($in, 'nombre', 120, true, 'el nombre');
        $tel = txt($in, 'telefono', 20);
        $rol = in_array($in['rol'] ?? '', ['admin', 'cliente'], true) ? $in['rol'] : fail('Elige un rol válido.', 422);
        if (mb_strlen($nombre) < 3) fail('Escribe el nombre.', 422);
        if (!tel_ok($tel)) fail('El teléfono debe tener 10 dígitos.', 422);
        if ($id) {
            $u = q1('SELECT * FROM usuarios WHERE id = ?', [$id]) ?? fail('El usuario no existe.', 404);
            if ($id === (int) $yo['id'] && $rol !== $u['rol']) fail('No puedes cambiar tu propio rol.', 409);
            q('UPDATE usuarios SET nombre = ?, telefono = ?, rol = ? WHERE id = ?', [$nombre, $tel, $rol, $id]);
        } else {
            $email = mb_strtolower(txt($in, 'email', 160, true, 'el correo'));
            $pass = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
            if (!email_ok($email)) fail('Escribe un correo válido.', 422);
            if (mb_strlen($pass) < 8) fail('La contraseña temporal necesita al menos 8 caracteres.', 422);
            if (q1('SELECT id FROM usuarios WHERE email = ?', [$email])) fail('Ese correo ya está registrado.', 409);
            q('INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES (?,?,?,?,?)', [$nombre, $email, password_hash($pass, PASSWORD_DEFAULT), $rol, $tel]);
            $id = last_id();
        }
        return ['id' => (string) $id];
    },

    'usuario_activo' => function (array $in): array {
        $yo = requerir('admin');
        $id = ident($in, 'id');
        if ($id === (int) $yo['id']) fail('No puedes desactivar tu propia cuenta.', 409);
        if (!q1('SELECT id FROM usuarios WHERE id = ?', [$id])) fail('El usuario no existe.', 404);
        q('UPDATE usuarios SET activo = ? WHERE id = ?', [!empty($in['activo']) ? 1 : 0, $id]);
        return [];
    },
];

$GET = ['datos' => 'datos', 'estado' => 'estado'];

/* ================= Despacho ================= */
try {
    iniciar_sesion();
    $accion = (string) ($_GET['accion'] ?? '');
    $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($metodo === 'GET' && isset($GET[$accion])) json_out(['ok' => true, 'data' => ($GET[$accion])()]);
    if ($metodo === 'POST' && isset($POST[$accion])) {
        // Defensa CSRF: otro sitio no puede mandar esta cabecera sin permiso CORS
        if (($_SERVER['HTTP_X_RFH'] ?? '') !== '1') fail('Solicitud no válida.', 400);
        $raw = file_get_contents('php://input') ?: '{}';
        if (strlen($raw) > 100000) fail('Solicitud demasiado grande.', 413);
        $in = json_decode($raw, true);
        if (!is_array($in)) fail('JSON no válido.', 400);
        json_out(['ok' => true, 'data' => $POST[$accion]($in)]);
    }
    fail('Acción no encontrada.', 404);
} catch (ApiError $e) {
    json_out(['ok' => false, 'error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    error_log('[ReyesFruitHub] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'No se pudo completar la operación en la base de datos.'], 500);
} catch (Throwable $e) {
    error_log('[ReyesFruitHub] ' . $e);
    json_out(['ok' => false, 'error' => 'Error interno del servidor.'], 500);
}
