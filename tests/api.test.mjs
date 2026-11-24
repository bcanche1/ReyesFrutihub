/*
 * ReyesFruitHub · pruebas de la API (funcionales y de seguridad)
 *   node tests/api.test.mjs http://localhost:8091
 * Úsalo SIEMPRE contra la base de pruebas (lo hace tests/probar.ps1): estas pruebas modifican datos.
 */
const BASE = (process.argv[2] || "http://localhost:8091").replace(/\/$/, "");
let pass = 0, fail = 0;
const resultados = [];

class Cliente {
  constructor() { this.cookie = ""; }
  async req(accion, body, { sinCabecera = false } = {}) {
    const headers = { Accept: "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    const opts = { headers };
    if (body !== undefined) {
      opts.method = "POST";
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      if (!sinCabecera) headers["X-RFH"] = "1";
    }
    const res = await fetch(`${BASE}/api/?accion=${accion}`, opts);
    const sc = res.headers.getSetCookie?.() || [];
    for (const c of sc) { const kv = c.split(";")[0]; if (kv.startsWith("RFHSESSID=")) this.cookie = kv.endsWith("=deleted") ? "" : kv; }
    let json = null;
    try { json = await res.json(); } catch { /* sin JSON */ }
    return { status: res.status, json, data: json && json.data, error: json && json.error };
  }
  datos() { return this.req("datos").then((r) => r.data); }
  async login(email, password = "demo123") { const r = await this.req("login", { email, password }); return r; }
}

async function prueba(nombre, fn) {
  try { await fn(); pass++; resultados.push(["✓", nombre]); console.log("  ✓ " + nombre); }
  catch (e) { fail++; resultados.push(["✗", nombre, e.message]); console.log("  ✗ " + nombre + "\n      → " + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "esperaba"} ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`); }
function ok(c, msg) { if (!c) throw new Error(msg); }
const stockDe = (d, nombre) => d.productos.find((p) => p.nombre === nombre).stock;
const prod = (d, nombre) => d.productos.find((p) => p.nombre === nombre);

console.log(`Pruebas de API contra ${BASE}\n`);

const anon = new Cliente();
const admin = new Cliente();
const cli = new Cliente();
const otro = new Cliente();

console.log("Conexión y acceso público");
await prueba("La API responde y reporta conexión a la base", async () => {
  const r = await anon.req("estado"); eq(r.status, 200); eq(r.data.conexion, "ok");
  ok(!("registros" in r.data), "no debe exponer conteos internos sin sesión de administrador");
});
await prueba("Visitante ve catálogo sin costos, lotes, proveedores ni usuarios", async () => {
  const d = await anon.datos();
  eq(d.usuario, null, "usuario");
  ok(d.productos.length > 0, "debe haber productos");
  ok(d.productos.every((p) => !("costo" in p) && !("proveedorId" in p)), "no debe exponer costo ni proveedor");
  ok(d.lotes.length === 0 && d.usuarios.length === 0 && d.proveedores.length === 0 && d.ventas.length === 0, "no debe exponer datos internos");
});
await prueba("Archivos internos no se sirven por web (.env, config, lib, esquema, chequeo)", async () => {
  for (const p of ["/.env", "/.env.example", "/api/config.php", "/api/lib.php", "/database/schema.sql", "/database/instalar.php", "/README.md", "/servidor.php"]) {
    const r = await fetch(BASE + p); eq(r.status, 404, p + " →");
  }
});
await prueba("Acción desconocida responde 404 en JSON", async () => { const r = await anon.req("borrar_todo"); eq(r.status, 404); eq(r.json.ok, false); });

console.log("\nAutenticación");
await prueba("Contraseña incorrecta → 401 con mensaje genérico", async () => {
  const r = await anon.req("login", { email: "admin@reyesfruithub.demo", password: "x" }); eq(r.status, 401); eq(r.error, "Correo o contraseña incorrectos.");
});
await prueba("Inyección SQL en el login no entra", async () => {
  const r = await new Cliente().req("login", { email: "' OR '1'='1' -- ", password: "' OR '1'='1" }); eq(r.status, 401);
});
await prueba("POST sin cabecera anti-CSRF se rechaza", async () => {
  const r = await new Cliente().req("login", { email: "admin@reyesfruithub.demo", password: "demo123" }, { sinCabecera: true }); eq(r.status, 400);
});
await prueba("JSON mal formado se rechaza", async () => { const r = await new Cliente().req("login", "{no es json"); eq(r.status, 400); });
await prueba("Login correcto de administrador y de cliente", async () => {
  eq((await admin.login("admin@reyesfruithub.demo")).status, 200);
  const r = await cli.login("cliente@reyesfruithub.demo"); eq(r.status, 200); eq(r.data.usuario.rol, "cliente");
  ok(!("password_hash" in r.data.usuario), "no debe devolver el hash");
});
await prueba("Registro valida correo, teléfono, contraseña y duplicados", async () => {
  const c = new Cliente();
  eq((await c.req("registro", { nombre: "Prueba", email: "no-es-correo", password: "12345678" })).status, 422, "correo inválido");
  eq((await c.req("registro", { nombre: "Prueba", email: "p@demo.mx", password: "corta" })).status, 422, "contraseña corta");
  eq((await c.req("registro", { nombre: "Prueba", email: "p@demo.mx", telefono: "123", password: "12345678" })).status, 422, "teléfono");
  eq((await c.req("registro", { nombre: "Prueba", email: "CLIENTE@reyesfruithub.demo", password: "12345678" })).status, 409, "duplicado (mayúsculas)");
  const r = await otro.req("registro", { nombre: "Ñandú Pérez 🍊", email: "nandu@demo.mx", telefono: "985 123 4567", password: "segura123" });
  eq(r.status, 200, "registro válido"); eq(r.data.usuario.nombre, "Ñandú Pérez 🍊", "acentos/emoji");
});
await prueba("Tras 5 intentos fallidos el login se bloquea (429)", async () => {
  const c = new Cliente();
  for (let i = 0; i < 5; i++) await c.req("login", { email: "admin@reyesfruithub.demo", password: "mal" });
  eq((await c.req("login", { email: "admin@reyesfruithub.demo", password: "demo123" })).status, 429);
});

console.log("\nControl de acceso por rol");
await prueba("Sin sesión no se puede operar (401)", async () => {
  eq((await anon.req("venta_registrar", { items: [] })).status, 401);
  eq((await anon.req("pedido_crear", { items: [] })).status, 401);
});
await prueba("Cliente no puede usar acciones de administrador (403)", async () => {
  for (const a of ["venta_registrar", "producto_guardar", "entrada_registrar", "usuario_guardar", "usuario_activo", "proveedor_guardar", "merma_registrar"])
    eq((await cli.req(a, {})).status, 403, a);
});
await prueba("Cliente solo ve sus propios pedidos y sin datos internos", async () => {
  const d = await cli.datos();
  ok(d.pedidos.length > 0, "debe tener pedidos demo");
  ok(d.pedidos.every((o) => o.clienteId === d.usuario.id), "solo pedidos propios");
  ok(d.usuarios.length === 0 && d.lotes.length === 0 && d.productos.every((p) => !("costo" in p)), "nada interno");
});
await prueba("Administrador no puede pedir como cliente", async () => {
  const d = await admin.datos();
  eq((await admin.req("pedido_crear", { items: [{ productoId: d.productos[0].id, cantidad: 1 }] })).status, 403);
});

console.log("\nPedidos en línea");
let folio;
await prueba("Rechaza cantidades negativas, fraccionarias inválidas y productos inexistentes", async () => {
  const d = await cli.datos();
  const kg = d.productos.find((p) => p.unidad === "kg" && p.stock - p.reservado > 3);
  const pz = d.productos.find((p) => p.unidad === "pieza" && p.stock - p.reservado > 3);
  eq((await cli.req("pedido_crear", { items: [{ productoId: kg.id, cantidad: -2 }] })).status, 422, "negativa");
  eq((await cli.req("pedido_crear", { items: [{ productoId: kg.id, cantidad: 0.3 }] })).status, 422, "0.3 kg");
  eq((await cli.req("pedido_crear", { items: [{ productoId: pz.id, cantidad: 1.5 }] })).status, 422, "1.5 piezas");
  eq((await cli.req("pedido_crear", { items: [{ productoId: "999999", cantidad: 1 }] })).status, 404, "inexistente");
  eq((await cli.req("pedido_crear", { items: [] })).status, 422, "vacío");
  eq((await cli.req("pedido_crear", { items: [{ productoId: kg.id, cantidad: 1 }, { productoId: kg.id, cantidad: 1 }] })).status, 422, "repetido");
});
await prueba("No deja pedir más de lo disponible", async () => {
  const d = await cli.datos();
  const p = d.productos.find((x) => x.stock > 0);
  const r = await cli.req("pedido_crear", { items: [{ productoId: p.id, cantidad: Math.ceil(p.stock) + 10 }] });
  eq(r.status, 409); ok(/Solo hay/.test(r.error), r.error);
});
await prueba("Domicilio sin dirección se rechaza", async () => {
  const d = await cli.datos();
  const p = d.productos.find((x) => x.unidad === "kg" && x.stock - x.reservado > 2);
  eq((await cli.req("pedido_crear", { items: [{ productoId: p.id, cantidad: 1 }], entrega: "domicilio", direccion: "" })).status, 422);
});
await prueba("El precio sale de la base aunque el navegador mande otro", async () => {
  const d = await cli.datos();
  const p = prod(d, "Naranja dulce");
  const r = await cli.req("pedido_crear", { items: [{ productoId: p.id, cantidad: 2, precio: 0.01 }], entrega: "recoger", notas: "<script>alert(1)</script>" });
  eq(r.status, 200, r.error); eq(r.data.total, p.precio * 2, "total"); folio = r.data.id;
  ok(/^PED-\d+$/.test(folio), "folio " + folio);
  const d2 = await cli.datos();
  eq(prod(d2, "Naranja dulce").reservado, p.reservado + 2, "debe quedar apartado");
  eq(d2.pedidos.find((o) => o.id === folio).notas, "<script>alert(1)</script>", "las notas se guardan tal cual (la interfaz las escapa)");
});
await prueba("Un cliente no puede cancelar pedidos de otro (404)", async () => {
  eq((await otro.req("pedido_estado", { id: folio, estado: "cancelado" })).status, 404);
});
await prueba("El cliente no puede avanzar su propio pedido", async () => {
  eq((await cli.req("pedido_estado", { id: folio, estado: "entregado" })).status, 409);
});
await prueba("Transición inválida (pendiente → entregado) se rechaza", async () => {
  eq((await admin.req("pedido_estado", { id: folio, estado: "entregado" })).status, 409);
});
await prueba("Entregar un pedido descuenta inventario por PEPS y genera UNA venta", async () => {
  const antes = await admin.datos();
  const p = prod(antes, "Naranja dulce");
  const lotes = antes.lotes.filter((l) => l.productoId === p.id).sort((a, b) => a.caducidad.localeCompare(b.caducidad));
  const ventasAntes = antes.ventas.length;
  for (const e of ["preparando", "listo", "entregado"]) eq((await admin.req("pedido_estado", { id: folio, estado: e })).status, 200, e);
  const desp = await admin.datos();
  eq(stockDe(desp, "Naranja dulce"), Math.round((p.stock - 2) * 100) / 100, "stock");
  const primero = desp.lotes.find((l) => l.id === lotes[0].id);
  const esperado = Math.max(0, lotes[0].cantidad - 2);
  eq(primero ? primero.cantidad : 0, esperado, "debe descontarse primero del lote que caduca antes");
  eq(desp.ventas.length, ventasAntes + 1, "una venta nueva");
  eq(desp.pedidos.find((o) => o.id === folio).historial.map((h) => h.estado).join(">"), "pendiente>preparando>listo>entregado", "historial");
  eq((await admin.req("pedido_estado", { id: folio, estado: "entregado" })).status, 409, "no se puede entregar dos veces");
});
await prueba("Cliente cancela su pedido pendiente y ya no puede volver a cancelarlo", async () => {
  const d = await cli.datos();
  const p = d.productos.find((x) => x.unidad === "pieza" && x.stock - x.reservado >= 1);
  const r = await cli.req("pedido_crear", { items: [{ productoId: p.id, cantidad: 1 }] });
  eq((await cli.req("pedido_estado", { id: r.data.id, estado: "cancelado" })).status, 200);
  eq((await cli.req("pedido_estado", { id: r.data.id, estado: "cancelado" })).status, 409);
});

console.log("\nVentas e inventario");
await prueba("Venta de mostrador que excede la existencia no deja cambios a medias (rollback)", async () => {
  const d = await admin.datos();
  const a = d.productos.find((p) => p.unidad === "kg" && p.stock >= 2);
  const b = d.productos.find((p) => p.id !== a.id && p.stock > 0);
  const r = await admin.req("venta_registrar", { items: [{ productoId: a.id, cantidad: 1 }, { productoId: b.id, cantidad: Math.ceil(b.stock) + 5 }] });
  eq(r.status, 409);
  eq(stockDe(await admin.datos(), a.nombre), a.stock, "el primer producto no debe haberse descontado");
});
await prueba("Venta de mostrador correcta descuenta y registra el total con precios de la base", async () => {
  const d = await admin.datos();
  const p = prod(d, "Limón persa");
  const r = await admin.req("venta_registrar", { items: [{ productoId: p.id, cantidad: 1.5, precio: 1 }], metodo: "tarjeta" });
  eq(r.status, 200, r.error); eq(r.data.total, p.precio * 1.5);
  eq(stockDe(await admin.datos(), "Limón persa"), Math.round((p.stock - 1.5) * 100) / 100);
});
// Nota: el servidor integrado de PHP en Windows atiende una petición a la vez, así que aquí se verifica la regla
// (nunca vender de más). El bloqueo real entre procesos lo prueba tests/concurrencia.php.
await prueba("Dos cajas venden la última pieza: solo una venta pasa y la existencia nunca queda negativa", async () => {
  const d = await admin.datos();
  const p = d.productos.find((x) => x.unidad === "pieza" && x.stock >= 2);
  const turno = new Cliente();
  eq((await turno.login("turno@reyesfruithub.demo")).status, 200, "segunda sesión de administrador");
  // Se vende todo menos 1 pieza; después dos cajas intentan vender esa última pieza al mismo tiempo
  eq((await admin.req("venta_registrar", { items: [{ productoId: p.id, cantidad: p.stock - 1 }] })).status, 200, "venta previa");
  const [a, b] = await Promise.all([
    admin.req("venta_registrar", { items: [{ productoId: p.id, cantidad: 1 }] }),
    turno.req("venta_registrar", { items: [{ productoId: p.id, cantidad: 1 }] })
  ]);
  eq([a.status, b.status].sort().join(","), "200,409", "una pasa y otra se rechaza");
  eq(stockDe(await admin.datos(), p.nombre), 0, "existencia final 0, nunca negativa");
});
await prueba("Entrada de mercancía valida fecha y crea lote + compra", async () => {
  const d = await admin.datos();
  const p = prod(d, "Guanábana");
  eq((await admin.req("entrada_registrar", { productoId: p.id, cantidad: 5, costo: 40, proveedorId: d.proveedores[0].id, caducidad: "2020-01-01" })).status, 422, "fecha pasada");
  eq((await admin.req("entrada_registrar", { productoId: p.id, cantidad: 0, costo: 40, proveedorId: d.proveedores[0].id, caducidad: "2099-01-01" })).status, 422, "cantidad 0");
  const r = await admin.req("entrada_registrar", { productoId: p.id, cantidad: 6, costo: 40, proveedorId: d.proveedores[0].id, caducidad: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10) });
  eq(r.status, 200, r.error);
  const d2 = await admin.datos();
  eq(stockDe(d2, "Guanábana"), p.stock + 6); eq(d2.compras.length, d.compras.length + 1, "compra nueva");
});
await prueba("Merma mayor a la existencia se rechaza; la válida descuenta", async () => {
  const d = await admin.datos();
  const p = d.productos.find((x) => x.stock >= 1);
  eq((await admin.req("merma_registrar", { productoId: p.id, cantidad: p.stock + 100, motivo: "Caducó" })).status, 409);
  eq((await admin.req("merma_registrar", { productoId: p.id, cantidad: 1, motivo: "Caducó" })).status, 200);
  eq(stockDe(await admin.datos(), p.nombre), Math.round((p.stock - 1) * 100) / 100);
});

console.log("\nCatálogo, proveedores y usuarios");
let nuevoId;
await prueba("Producto: valida costo > precio, nombre duplicado e imagen insegura", async () => {
  const d = await admin.datos();
  const base = { nombre: "Producto prueba", categoria: "frutas", unidad: "kg", precio: 10, costo: 5, stockMinimo: 1, vidaDias: 3, proveedorId: d.proveedores[0].id, activo: true };
  eq((await admin.req("producto_guardar", { ...base, costo: 20 })).status, 422, "costo > precio");
  eq((await admin.req("producto_guardar", { ...base, nombre: "Fresa" })).status, 409, "duplicado");
  eq((await admin.req("producto_guardar", { ...base, imagen: "javascript:alert(1)" })).status, 422, "imagen javascript:");
  eq((await admin.req("producto_guardar", { ...base, categoria: "inventada" })).status, 422, "categoría");
  const r = await admin.req("producto_guardar", { ...base, nombre: '<img src=x onerror="alert(1)">' });
  eq(r.status, 200, r.error); nuevoId = r.data.id;
});
await prueba("Eliminar producto con historial se impide; sin historial se permite", async () => {
  const d = await admin.datos();
  eq((await admin.req("producto_eliminar", { id: prod(d, "Fresa").id })).status, 409);
  eq((await admin.req("producto_eliminar", { id: nuevoId })).status, 200);
});
await prueba("Proveedor: teléfono de 10 dígitos obligatorio y categorías válidas", async () => {
  eq((await admin.req("proveedor_guardar", { nombre: "Prov X", telefono: "123", activo: true })).status, 422);
  const r = await admin.req("proveedor_guardar", { nombre: "Prov X", telefono: "999 111 2233", activo: true, categorias: ["frutas", "no-existe"] });
  eq(r.status, 200, r.error);
  eq((await admin.datos()).proveedores.find((p) => p.id === r.data.id).categorias.join(), "frutas");
});
await prueba("Administrador no puede desactivarse ni cambiarse el rol a sí mismo", async () => {
  const d = await admin.datos();
  eq((await admin.req("usuario_activo", { id: d.usuario.id, activo: false })).status, 409);
  eq((await admin.req("usuario_guardar", { id: d.usuario.id, nombre: d.usuario.nombre, rol: "cliente" })).status, 409);
});
await prueba("Usuario desactivado no puede entrar y pierde su sesión activa", async () => {
  const d = await admin.datos();
  const u = d.usuarios.find((x) => x.email === "nandu@demo.mx");
  eq((await admin.req("usuario_activo", { id: u.id, activo: false })).status, 200);
  eq((await otro.datos()).usuario, null, "la sesión abierta deja de valer");
  eq((await new Cliente().login("nandu@demo.mx", "segura123")).status, 403);
});
await prueba("Cerrar sesión invalida la cookie", async () => {
  eq((await cli.req("salir", {})).status, 200);
  eq((await cli.datos()).usuario, null);
  eq((await cli.req("pedido_crear", { items: [] })).status, 401);
});

console.log(`\nResultado: ${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
