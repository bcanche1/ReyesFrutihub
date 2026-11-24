/* ReyesFruitHub · piezas compartidas entre páginas */
(function (RFH) {
  "use strict";

  /* Íconos declarativos: data-icon="leaf" (reemplaza contenido),
     data-icon-before / data-icon-after (lo agrega junto al texto) */
  RFH.hydrateIcons = function (root) {
    (root || document).querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = RFH.icon(el.dataset.icon); el.removeAttribute("data-icon"); });
    (root || document).querySelectorAll("[data-icon-before]").forEach((el) => { el.insertAdjacentHTML("afterbegin", RFH.icon(el.dataset.iconBefore, "icon-sm")); el.removeAttribute("data-icon-before"); });
    (root || document).querySelectorAll("[data-icon-after]").forEach((el) => { el.insertAdjacentHTML("beforeend", RFH.icon(el.dataset.iconAfter, "icon-sm")); el.removeAttribute("data-icon-after"); });
  };

  /* Disponibilidad para el cliente (no muestra cifras internas exactas si sobra) */
  RFH.disponibilidad = function (p) {
    const d = RFH.db.disponible(p.id);
    if (d <= 0) return { kind: "crit", text: "Agotado", d: 0 };
    if (d <= p.stockMinimo) return { kind: "warn", text: "Quedan " + RFH.fmt.qty(d, p.unidad), d: d };
    return { kind: "ok", text: "Disponible", d: d };
  };

  RFH.productCard = function (p, opts) {
    const disp = RFH.disponibilidad(p);
    const out = disp.d <= 0;
    let action;
    if (opts && opts.cart && opts.qty > 0) {
      action = '<div class="stepper" role="group" aria-label="Cantidad de ' + RFH.esc(p.nombre) + '">' +
        '<button type="button" data-dec="' + p.id + '" aria-label="Quitar">' + RFH.icon("minus", "icon-sm") + "</button>" +
        "<output>" + RFH.fmt.num(opts.qty) + "</output>" +
        '<button type="button" data-inc="' + p.id + '" aria-label="Agregar más"' + (opts.qty >= disp.d ? " disabled" : "") + ">" + RFH.icon("plus", "icon-sm") + "</button></div>";
    } else if (opts && opts.cart) {
      action = out
        ? '<button class="btn-add" type="button" disabled aria-label="' + RFH.esc(p.nombre) + ' agotado">' + RFH.icon("x") + "</button>"
        : '<button class="btn-add" type="button" data-add="' + p.id + '" aria-label="Agregar ' + RFH.esc(p.nombre) + ' al carrito">' + RFH.icon("plus") + "</button>";
    } else {
      action = out ? "" : '<a class="btn-add" href="login.html?modo=registro" aria-label="Pedir ' + RFH.esc(p.nombre) + '">' + RFH.icon("plus") + "</a>";
    }
    return '<article class="product' + (out ? " is-out" : "") + '">' +
      '<div class="product-media">' + RFH.fruitArt(p) +
      '<span class="product-badge">' + RFH.badge(disp.kind, disp.text) + "</span>" +
      (p.destacado && !out ? '<span class="product-flag">' + RFH.icon("leaf", "icon-sm") + "Favorito</span>" : "") + "</div>" +
      '<div class="product-body">' +
      '<span class="product-cat">' + RFH.esc(RFH.db.categoria(p.categoria)) + "</span>" +
      "<h3>" + RFH.esc(p.nombre) + "</h3>" +
      '<div class="product-foot"><span class="price">' + RFH.fmt.money(p.precio) + " <small>/ " + RFH.fmt.unit(p.unidad, 1) + "</small></span>" + action + "</div>" +
      "</div></article>";
  };

  /* Mosaicos de categoría con la foto de un producto representativo */
  RFH.categoryTiles = function (activa, contar) {
    const fotoDe = (cat) => (RFH.db.productos.find((p) => p.categoria === cat && p.imagen && p.destacado) || RFH.db.productos.find((p) => p.categoria === cat && p.imagen) || {}).imagen;
    return [{ id: "todos", nombre: "Todo" }].concat(RFH.db.categorias).map((c) => {
      const img = c.id === "todos" ? "assets/img/portada.webp" : fotoDe(c.id);
      return '<button class="cat-tile" type="button" data-cat="' + c.id + '" aria-pressed="' + (c.id === activa) + '">' +
        (img ? '<img src="' + RFH.esc(img) + '" alt="" loading="lazy" width="320" height="240">' : "") +
        '<span class="cat-name">' + RFH.esc(c.nombre) + '<small>' + RFH.fmt.plural(contar(c.id), "producto", "productos") + "</small></span></button>";
    }).join("");
  };

  /* Armazón de app con rutas por hash (#vista). routes: { clave: { title, icon, render(el) } } */
  RFH.shell = function (opts) {
    const side = document.getElementById("sidebar");
    const scrim = document.getElementById("scrim");
    const menuBtn = document.getElementById("btn-menu");
    const vista = document.getElementById("vista");
    const u = opts.user;

    document.getElementById("u-avatar").textContent = RFH.fmt.initials(u.nombre);
    document.getElementById("u-name").textContent = u.nombre;
    document.getElementById("u-mail").textContent = u.email;
    document.getElementById("btn-salir").addEventListener("click", () => RFH.db.salir());

    const setMenu = (open) => {
      side.classList.toggle("is-open", open);
      scrim.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", open);
      if (open) side.querySelector("a, button").focus();
    };
    menuBtn.addEventListener("click", () => setMenu(!side.classList.contains("is-open")));
    scrim.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && side.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); } });

    function navHtml() {
      let html = "";
      opts.nav.forEach((item) => {
        if (item.group) { html += '<div class="nav-group">' + RFH.esc(item.group) + "</div>"; return; }
        const r = opts.routes[item.key];
        const badge = item.badge ? item.badge() : 0;
        html += '<a class="nav-link" href="#' + item.key + '" data-route="' + item.key + '">' + RFH.icon(r.icon) + "<span>" + RFH.esc(r.title) + "</span>" +
          (badge ? '<span class="pill" aria-label="' + badge + ' pendientes">' + badge + "</span>" : "") + "</a>";
      });
      document.getElementById("side-nav").innerHTML = html;
    }

    function current() { const k = location.hash.slice(1); return opts.routes[k] ? k : opts.default; }

    function render(focus) {
      const key = current();
      const r = opts.routes[key];
      navHtml();
      document.querySelectorAll("[data-route]").forEach((a) => { if (a.dataset.route === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
      document.getElementById("view-title").textContent = r.title;
      document.title = r.title + " | ReyesFruitHub";
      vista.classList.remove("view-enter");
      void vista.offsetWidth;
      vista.classList.add("view-enter");
      r.render(vista);
      RFH.hydrateIcons(vista);
      if (opts.afterRender) opts.afterRender(key);
      if (focus) { vista.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    }

    window.addEventListener("hashchange", () => { setMenu(false); render(true); });
    render(false);
    return { refresh: () => render(false) };
  };

  /* Arranque de cada página: carga datos del servidor y, si no hay conexión, lo explica */
  RFH.arrancar = async function (init) {
    try {
      await RFH.db.cargar();
      await init();
    } catch (e) {
      console.error(e);
      document.body.insertAdjacentHTML("beforeend",
        '<div class="offline" role="alert"><div class="card stack">' + RFH.icon("alert") +
        "<h2>No se pudo conectar con el servidor</h2><p>" + RFH.esc(e.message) + "</p>" +
        '<p class="small muted">Si abriste el archivo con doble clic, cierra esta pestaña y ejecuta <strong>iniciar.bat</strong> en la carpeta del proyecto.</p>' +
        '<button class="btn btn-primary" type="button" onclick="location.reload()">Reintentar</button></div></div>');
    }
  };

  /* Los scripts van al final del <body>: se pinta todo antes del primer cuadro (evita saltos/CLS) */
  RFH.hydrateIcons();
})(window.RFH);
