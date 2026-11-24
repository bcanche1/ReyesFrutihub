/* ReyesFruitHub · módulo de CLIENTE (cliente.html) */
(function (RFH) {
  "use strict";
  const db = RFH.db;
  const fmt = RFH.fmt;
  const esc = RFH.esc;
  RFH.arrancar(main);

  function main() {
  const user = db.requerir("cliente");
  if (!user) return;

  /* ---------- Carrito (localStorage por usuario) ---------- */
  const CART_KEY = "rfh_cart_" + user.id;
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { cart = {}; }
  const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const paso = (p) => (p.unidad === "kg" ? 0.5 : 1);
  const cartItems = () => Object.keys(cart).map((id) => ({ p: db.producto(id), qty: cart[id] })).filter((x) => x.p && x.qty > 0);
  const cartCount = () => cartItems().length;
  const cartTotal = () => cartItems().reduce((s, x) => s + x.qty * x.p.precio, 0);

  function setQty(pid, qty) {
    const p = db.producto(pid);
    const max = Math.floor(db.disponible(pid) / paso(p)) * paso(p); // solo cantidades válidas (0.5 kg o enteras)
    qty = Math.round(qty * 2) / 2;
    if (qty > max) { qty = max; RFH.toast("Solo hay " + fmt.qty(max, p.unidad) + " de " + p.nombre, "error"); }
    if (qty <= 0) delete cart[pid]; else cart[pid] = qty;
    saveCart();
    updateCounters();
  }

  function updateCounters() {
    const n = cartCount();
    document.getElementById("top-cart-n").textContent = n;
    document.getElementById("top-cart").setAttribute("aria-label", "Ver carrito, " + fmt.plural(n, "producto", "productos"));
    renderBottomNav();
  }

  /* ---------- Vistas ---------- */
  let filtro = "todos";
  let busqueda = "";

  function viewCatalogo(el) {
    el.innerHTML =
      '<section class="welcome"><img src="assets/img/portada.webp" alt="" width="1600" height="1067">' +
      "<h2>Hola, " + esc((db.sesion() || user).nombre.split(" ")[0]) + "</h2><p>¿Qué se te antoja hoy? Toca <strong>+</strong> para agregar y confirma tu pedido en el carrito.</p></section>" +
      '<div class="toolbar"><div class="input-icon">' + RFH.icon("search") + '<label class="sr-only" for="q">Buscar producto</label><input class="input" id="q" type="search" placeholder="Buscar: mango, limón, cilantro…" autocomplete="off" value="' + esc(busqueda) + '"></div></div>' +
      '<div class="cat-tiles" role="group" aria-label="Filtrar por categoría" id="chips" style="margin-bottom:var(--s-5)"></div>' +
      '<div class="products" id="grid" aria-live="polite"></div>';

    const chips = el.querySelector("#chips");
    const renderChips = () => {
      chips.innerHTML = RFH.categoryTiles(filtro, (cat) => db.productos.filter((p) => p.activo && (cat === "todos" || p.categoria === cat)).length);
    };
    const renderGrid = () => {
      const q = busqueda.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const list = db.productos.filter((p) => p.activo)
        .filter((p) => filtro === "todos" || p.categoria === filtro)
        .filter((p) => !q || p.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q))
        .sort((a, b) => (db.disponible(b.id) > 0) - (db.disponible(a.id) > 0) || a.nombre.localeCompare(b.nombre, "es"));
      el.querySelector("#grid").innerHTML = list.length
        ? list.map((p) => RFH.productCard(p, { cart: true, qty: cart[p.id] || 0 })).join("")
        : '<div class="empty" style="grid-column:1/-1">' + RFH.icon("search") + "<strong>No encontramos «" + esc(busqueda) + "»</strong><span>Revisa la ortografía o prueba otra categoría.</span></div>";
    };
    renderChips();
    renderGrid();

    el.querySelector("#q").addEventListener("input", (e) => { busqueda = e.target.value; renderGrid(); });
    chips.addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; filtro = b.dataset.cat; renderChips(); renderGrid(); });
    el.querySelector("#grid").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]"), inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
      const b = add || inc || dec;
      if (!b) return;
      const pid = b.dataset.add || b.dataset.inc || b.dataset.dec;
      const p = db.producto(pid);
      const cur = cart[pid] || 0;
      setQty(pid, dec ? cur - paso(p) : cur + paso(p));
      if (add) RFH.toast(p.nombre + " agregado al carrito");
      const focusSel = cart[pid] ? (dec ? '[data-dec="' + pid + '"]' : '[data-inc="' + pid + '"]') : '[data-add="' + pid + '"]';
      renderGrid();
      const f = el.querySelector(focusSel) || el.querySelector('[data-dec="' + pid + '"]');
      if (f) f.focus();
    });
  }

  function viewCarrito(el) {
    const items = cartItems();
    if (!items.length) {
      el.innerHTML = '<div class="card"><div class="empty">' + RFH.icon("cart") + "<strong>Tu carrito está vacío</strong><span>Agrega fruta o verdura desde el catálogo.</span>" +
        '<a class="btn btn-primary" href="#catalogo">Ir al catálogo</a></div></div>';
      return;
    }
    el.innerHTML =
      '<div class="checkout">' +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h2>Tu carrito</h2><span class="spacer"></span><span class="muted small">' + fmt.plural(items.length, "producto", "productos") + "</span></div><div id=\"lines\"></div></div>" +
      '<form class="card stack" id="f-entrega" novalidate>' +
      "<h2 style=\"font-size:var(--fs-lg)\">Entrega</h2>" +
      '<fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">Forma de entrega</legend><div class="segmented">' +
      '<label><input type="radio" name="entrega" value="recoger" checked><span>' + RFH.icon("store", "icon-sm") + "Recoger en tienda</span></label>" +
      '<label><input type="radio" name="entrega" value="domicilio"><span>' + RFH.icon("truck", "icon-sm") + "A domicilio</span></label>" +
      "</div></fieldset>" +
      '<div id="dir-wrap" hidden>' + RFH.field({ name: "direccion", label: "Dirección de entrega", value: user.direccion, attrs: 'autocomplete="street-address"', hint: "Calle, número, cruzamientos y colonia." }) + "</div>" +
      RFH.field({ name: "notas", label: "Notas para la frutería (opcional)", type: "textarea", hint: "Ej. «aguacates maduros para hoy», «plátano verde»." }) +
      "</form></div>" +
      '<aside class="card" aria-labelledby="res-t"><h2 id="res-t" style="font-size:var(--fs-lg);margin-bottom:var(--s-3)">Resumen</h2><div id="summary"></div>' +
      '<button class="btn btn-accent btn-block" type="button" id="btn-confirmar" style="margin-top:var(--s-4)">Confirmar pedido</button>' +
      '<p class="xs muted" style="margin-top:var(--s-3)">Pagas al recoger o al recibir. El precio final de productos por kilo puede variar según el peso real.</p></aside>' +
      "</div>";

    const renderLines = () => {
      const its = cartItems();
      el.querySelector("#lines").innerHTML = its.map(({ p, qty }) =>
        '<div class="cart-line">' + RFH.fruitArt(p) +
        '<div class="grow"><strong>' + esc(p.nombre) + '</strong><span class="small muted num">' + fmt.money(p.precio) + " / " + fmt.unit(p.unidad, 1) + " · " + fmt.money(p.precio * qty) + "</span>" +
        '<div class="row" style="margin-top:6px"><div class="stepper" role="group" aria-label="Cantidad de ' + esc(p.nombre) + '"><button type="button" data-dec="' + p.id + '" aria-label="Quitar">' + RFH.icon("minus", "icon-sm") + "</button><output>" + fmt.num(qty) + '</output><button type="button" data-inc="' + p.id + '" aria-label="Agregar más">' + RFH.icon("plus", "icon-sm") + "</button></div>" +
        '<span class="small muted">' + fmt.unit(p.unidad, qty) + "</span></div></div>" +
        '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-del="' + p.id + '" aria-label="Eliminar ' + esc(p.nombre) + '">' + RFH.icon("trash", "icon-sm") + "</button></div>").join("");
      const total = cartTotal();
      el.querySelector("#summary").innerHTML =
        '<div class="summary-row"><span>Subtotal</span><span>' + fmt.money(total) + "</span></div>" +
        '<div class="summary-row"><span>Envío</span><span class="muted">' + (el.querySelector('[name="entrega"]:checked').value === "domicilio" ? "[COSTO DE ENVÍO]" : "Sin costo") + "</span></div>" +
        '<div class="summary-row total"><span>Total estimado</span><span>' + fmt.money(total) + "</span></div>";
      if (!its.length) viewCarrito(el);
    };
    renderLines();

    el.querySelector("#lines").addEventListener("click", (e) => {
      const b = e.target.closest("[data-inc],[data-dec],[data-del]");
      if (!b) return;
      const pid = b.dataset.inc || b.dataset.dec || b.dataset.del;
      const p = db.producto(pid);
      if (b.dataset.del) { setQty(pid, 0); RFH.toast(p.nombre + " eliminado"); }
      else setQty(pid, (cart[pid] || 0) + (b.dataset.inc ? paso(p) : -paso(p)));
      renderLines();
    });
    el.querySelectorAll('[name="entrega"]').forEach((r) => r.addEventListener("change", () => {
      el.querySelector("#dir-wrap").hidden = el.querySelector('[name="entrega"]:checked').value !== "domicilio";
      renderLines();
    }));
    el.querySelector("#btn-confirmar").addEventListener("click", async () => {
      const f = el.querySelector("#f-entrega");
      const entrega = f.querySelector('[name="entrega"]:checked').value;
      if (entrega === "domicilio" && !RFH.validate(f, { direccion: (v) => v.length < 8 ? "Escribe la dirección completa para poder llevar tu pedido." : "" })) return;
      const faltan = cartItems().filter(({ p, qty }) => qty > db.disponible(p.id));
      if (faltan.length) { RFH.toast("Ya no hay suficiente " + faltan[0].p.nombre + ". Ajusta la cantidad.", "error"); return; }
      const btn = el.querySelector("#btn-confirmar");
      btn.disabled = true; btn.textContent = "Enviando pedido…";
      try {
        const items = cartItems().map(({ p, qty }) => ({ productoId: p.id, cantidad: qty }));
        const pedido = await db.crearPedido(items, entrega, entrega === "domicilio" ? f.direccion.value.trim() : "", f.notas.value.trim());
        cart = {}; saveCart(); updateCounters();
        RFH.toast("Pedido " + pedido.id + " enviado. Te avisaremos cuando esté listo.");
        location.hash = "#pedidos";
      } catch (err) {
        RFH.toast(err.message, "error");
        await db.cargar().catch(() => {});   // existencias al día por si otro cliente se adelantó
        btn.disabled = false; btn.textContent = "Confirmar pedido";
        renderLines();
      }
    });
  }

  const PASOS = [["pendiente", "Recibido"], ["preparando", "Preparando"], ["listo", "Listo"], ["entregado", "Entregado"]];
  const ESTADO = { pendiente: ["info", "Recibido"], preparando: ["accent", "Preparando"], listo: ["ok", "Listo para entregar"], entregado: ["ok", "Entregado"], cancelado: ["crit", "Cancelado"] };

  function viewPedidos(el) {
    const mios = db.pedidos.filter((o) => o.clienteId === user.id);
    if (!mios.length) {
      el.innerHTML = '<div class="card"><div class="empty">' + RFH.icon("bag") + "<strong>Aún no tienes pedidos</strong><span>Cuando confirmes uno, aquí verás en qué va.</span><a class=\"btn btn-primary\" href=\"#catalogo\">Hacer mi primer pedido</a></div></div>";
      return;
    }
    el.innerHTML = '<div class="page-head"><div><h2>Mis pedidos</h2><p>Sigue el estado de cada pedido. Puedes cancelar mientras siga en «Recibido».</p></div></div><div class="grid" id="orders"></div>';
    el.querySelector("#orders").innerHTML = mios.map((o) => {
      const idx = PASOS.findIndex((s) => s[0] === o.estado);
      const est = ESTADO[o.estado];
      return '<article class="card order-card">' +
        '<div class="row"><div><h3 class="num">' + esc(o.id) + '</h3><span class="small muted">' + fmt.dateTime(o.fecha) + " · " + (o.entrega === "domicilio" ? "A domicilio" : "Recoger en tienda") + "</span></div><span class=\"spacer\"></span>" + RFH.badge(est[0], est[1]) + "</div>" +
        (o.estado !== "cancelado" ? '<div class="timeline" aria-label="Avance del pedido">' + PASOS.map((s, i) => '<div class="tl-step' + (i <= idx ? " is-done" : "") + '">' + s[1] + "</div>").join("") + "</div>" : "") +
        '<p class="order-items">' + o.items.map((i) => esc(i.nombre) + " × " + fmt.qty(i.cantidad, i.unidad)).join(" · ") + "</p>" +
        (o.direccion ? '<p class="small muted">Entregar en: ' + esc(o.direccion) + "</p>" : "") +
        (o.notas ? '<p class="small muted">Nota: ' + esc(o.notas) + "</p>" : "") +
        '<div class="row"><span class="price">' + fmt.money(o.total) + "</span><span class=\"spacer\"></span>" +
        (o.estado === "pendiente" ? '<button class="btn btn-ghost btn-sm" type="button" data-cancel="' + o.id + '">Cancelar pedido</button>' : "") +
        (o.estado === "entregado" ? '<button class="btn btn-soft btn-sm" type="button" data-repeat="' + o.id + '">' + RFH.icon("refresh", "icon-sm") + "Volver a pedir</button>" : "") +
        "</div></article>";
    }).join("");
    el.querySelector("#orders").addEventListener("click", (e) => {
      const c = e.target.closest("[data-cancel]"), r = e.target.closest("[data-repeat]");
      if (c) RFH.confirm("¿Cancelar " + c.dataset.cancel + "?", "La frutería dejará de apartar estos productos.", "Sí, cancelar", async () => { await db.cambiarEstado(c.dataset.cancel, "cancelado"); RFH.toast("Pedido cancelado"); viewPedidos(el); RFH.hydrateIcons(el); updateCounters(); });
      if (r) {
        const o = db.pedidos.find((x) => x.id === r.dataset.repeat);
        o.items.forEach((i) => {
          const p = db.producto(i.productoId);
          if (!p) return;
          const d = Math.floor(db.disponible(p.id) / paso(p)) * paso(p);
          if (d > 0) cart[p.id] = Math.min(d, i.cantidad);
        });
        saveCart(); updateCounters();
        RFH.toast("Productos disponibles agregados al carrito");
        location.hash = "#carrito";
      }
    });
  }

  function viewPerfil(el) {
    const user = db.sesion();
    el.innerHTML = '<div class="page-head"><div><h2>Mis datos</h2><p>Los usamos solo para preparar y entregar tus pedidos.</p></div></div>' +
      '<form class="card" id="f-perfil" novalidate style="max-width:640px"><div class="form-grid cols-2">' +
      RFH.field({ name: "nombre", label: "Nombre completo", value: user.nombre, attrs: 'autocomplete="name"', span: true }) +
      RFH.field({ name: "email", label: "Correo", value: user.email, type: "email", attrs: "readonly", hint: "El correo no se puede cambiar." }) +
      RFH.field({ name: "telefono", label: "Teléfono", value: user.telefono, type: "tel", attrs: 'autocomplete="tel" inputmode="tel"' }) +
      RFH.field({ name: "direccion", label: "Dirección para entregas", value: user.direccion, attrs: 'autocomplete="street-address"', span: true }) +
      '</div><div class="row" style="margin-top:var(--s-5)"><button class="btn btn-primary" type="submit">Guardar cambios</button></div></form>';
    el.querySelector("#f-perfil").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!RFH.validate(f, { nombre: (v) => v.length < 3 ? "Escribe tu nombre." : "", telefono: (v) => v && v.replace(/\D/g, "").length !== 10 ? "El teléfono debe tener 10 dígitos." : "" })) return;
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await db.guardarPerfil({ nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), direccion: f.direccion.value.trim() });
        const u = db.sesion();
        document.getElementById("u-name").textContent = u.nombre;
        document.getElementById("u-avatar").textContent = fmt.initials(u.nombre);
        RFH.toast("Datos guardados");
      } catch (err) { RFH.toast(err.message, "error"); }
      btn.disabled = false;
    });
  }

  const routes = {
    catalogo: { title: "Catálogo", icon: "leaf", render: viewCatalogo },
    carrito: { title: "Carrito", icon: "cart", render: viewCarrito },
    pedidos: { title: "Mis pedidos", icon: "bag", render: viewPedidos },
    perfil: { title: "Mis datos", icon: "user", render: viewPerfil }
  };
  const activos = () => db.pedidos.filter((o) => o.clienteId === user.id && ["pendiente", "preparando", "listo"].includes(o.estado)).length;

  function renderBottomNav() {
    const key = routes[location.hash.slice(1)] ? location.hash.slice(1) : "catalogo";
    const badges = { carrito: cartCount(), pedidos: activos() };
    document.getElementById("bottom-nav").innerHTML = Object.keys(routes).map((k) =>
      '<a href="#' + k + '"' + (k === key ? ' aria-current="page"' : "") + ">" + RFH.icon(routes[k].icon) + "<span>" + ({ catalogo: "Catálogo", carrito: "Carrito", pedidos: "Pedidos", perfil: "Mis datos" })[k] + "</span>" +
      (badges[k] ? '<span class="pill">' + badges[k] + "</span>" : "") + "</a>").join("");
  }

  (function init() {
    RFH.shell({
      user: user,
      default: "catalogo",
      routes: routes,
      nav: [{ group: "Comprar" }, { key: "catalogo" }, { key: "carrito", badge: cartCount }, { group: "Mi cuenta" }, { key: "pedidos", badge: activos }, { key: "perfil" }],
      afterRender: () => { updateCounters(); }
    });
  })();
  } // main
})(window.RFH);
