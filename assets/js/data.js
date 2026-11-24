/* =========================================================
   ReyesFruitHub · capa de datos conectada a la API (PHP + MySQL)
   ---------------------------------------------------------
   - cargar() trae del servidor solo lo que el rol actual puede ver.
   - Los getters leen esa copia en memoria (síncronos).
   - Cada cambio es una llamada POST; después se recarga la copia.
   Toda validación importante se repite en el servidor (api/index.php).
   ========================================================= */
window.RFH = window.RFH || {};

(function (RFH) {
  "use strict";

  const API = "api/";
  const DAY = 86400000;
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  let cache = null;

  async function call(accion, body) {
    const opts = body === undefined
      ? { credentials: "same-origin", headers: { Accept: "application/json" } }
      : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json", "X-RFH": "1" }, body: JSON.stringify(body) };
    let res;
    try { res = await fetch(API + "?accion=" + encodeURIComponent(accion), opts); }
    catch (e) { const err = new Error("No hay conexión con el servidor. Abre la aplicación con iniciar.bat (http://localhost:8080)."); err.offline = true; throw err; }
    let json;
    try { json = await res.json(); }
    catch (e) { const err = new Error("El servidor respondió algo inesperado (" + res.status + "). Abre la aplicación con iniciar.bat."); err.offline = true; throw err; }
    if (!json.ok) {
      const err = new Error(json.error || "No se pudo completar la operación.");
      err.status = res.status;
      if (res.status === 401 && accion !== "login") setTimeout(() => location.replace("login.html"), 1200);
      throw err;
    }
    return json.data;
  }
  async function cargar() { cache = await call("datos"); return cache; }
  async function mutar(accion, body) { const r = await call(accion, body); await cargar(); return r; }
  const c = () => cache || { categorias: [], productos: [], proveedores: [], lotes: [], compras: [], ventas: [], pedidos: [], usuarios: [], mermas: [] };
  const byId = (list, id) => list.find((x) => String(x.id) === String(id));

  const api = {
    cargar: cargar,
    call: call,
    get categorias() { return c().categorias; },
    get productos() { return c().productos; },
    get proveedores() { return c().proveedores; },
    get lotes() { return c().lotes; },
    get compras() { return c().compras; },
    get ventas() { return c().ventas; },
    get pedidos() { return c().pedidos; },
    get usuarios() { return c().usuarios; },
    get mermas() { return c().mermas; },

    producto: (id) => byId(c().productos, id),
    proveedor: (id) => byId(c().proveedores, id),
    usuario: (id) => byId(c().usuarios, id) || (c().usuario && String(c().usuario.id) === String(id) ? c().usuario : undefined),
    categoria: (id) => (c().categorias.find((x) => x.id === id) || { nombre: id }).nombre,

    /* Inventario (calculado en el servidor a partir de los lotes) */
    stock: function (pid) { const p = this.producto(pid); return p ? p.stock : 0; },
    reservado: function (pid) { const p = this.producto(pid); return p ? p.reservado : 0; },
    disponible: function (pid) { return Math.max(0, Math.round((this.stock(pid) - this.reservado(pid)) * 100) / 100); },
    lotesDe: (pid) => c().lotes.filter((l) => String(l.productoId) === String(pid) && l.cantidad > 0).sort((a, b) => a.caducidad.localeCompare(b.caducidad)),
    proximaCaducidad: function (pid) { const p = this.producto(pid); return p ? p.proximaCaducidad : null; },
    diasPara: (isoDate) => Math.round((startOfDay(isoDate) - startOfDay(Date.now())) / DAY),
    estadoStock: function (p) {
      const s = this.stock(p.id);
      if (s <= 0) return { kind: "crit", text: "Agotado", key: "agotado" };
      if (s <= p.stockMinimo) return { kind: "warn", text: "Stock bajo", key: "bajo" };
      return { kind: "ok", text: "Suficiente", key: "ok" };
    },
    estadoCaducidad: function (pid) {
      const cad = this.stock(pid) > 0 ? this.proximaCaducidad(pid) : null;
      if (!cad) return null;
      const d = this.diasPara(cad);
      if (d < 0) return { kind: "crit", text: "Caducado", dias: d };
      if (d <= 2) return { kind: "warn", text: d === 0 ? "Caduca hoy" : "Caduca en " + RFH.fmt.plural(d, "día", "días"), dias: d };
      return { kind: "ok", text: "En " + d + " días", dias: d };
    },

    /* Operaciones (todas devuelven promesas; lanzan Error con el mensaje del servidor) */
    crearPedido: (items, entrega, direccion, notas) => mutar("pedido_crear", { items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })), entrega: entrega, direccion: direccion, notas: notas }),
    cambiarEstado: (id, estado) => mutar("pedido_estado", { id: id, estado: estado }),
    registrarVenta: (o) => mutar("venta_registrar", { items: o.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })), metodo: o.metodo }),
    guardarProducto: (o) => mutar("producto_guardar", o),
    eliminarProducto: (id) => mutar("producto_eliminar", { id: id }),
    registrarEntrada: (o) => mutar("entrada_registrar", o),
    registrarMerma: (pid, cantidad, motivo) => mutar("merma_registrar", { productoId: pid, cantidad: cantidad, motivo: motivo }),
    guardarProveedor: (o) => mutar("proveedor_guardar", o),
    guardarUsuario: (o) => mutar("usuario_guardar", o),
    usuarioActivo: (id, activo) => mutar("usuario_activo", { id: id, activo: activo }),
    guardarPerfil: (o) => mutar("perfil", o),

    /* Sesión (la valida el servidor; esto solo decide a qué pantalla ir) */
    login: async function (email, password) {
      try { const r = await call("login", { email: email, password: password }); await cargar(); return { user: r.usuario }; }
      catch (e) { return { error: e.message }; }
    },
    registrar: async function (o) {
      try { const r = await call("registro", o); await cargar(); return { user: r.usuario }; }
      catch (e) { return { error: e.message }; }
    },
    sesion: () => (cache ? cache.usuario : null),
    salir: async function () { try { await call("salir", {}); } finally { location.href = "login.html"; } },
    requerir: function (rol) {
      const u = this.sesion();
      if (!u) { location.replace("login.html?siguiente=" + rol); return null; }
      if (u.rol !== rol) { location.replace(u.rol === "admin" ? "admin.html" : "cliente.html"); return null; }
      return u;
    }
  };

  RFH.db = api;
})(window.RFH);
