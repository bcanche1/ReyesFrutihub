/* ReyesFruitHub · módulo de ADMINISTRADOR (admin.html) */
(function (RFH) {
  "use strict";
  const db = RFH.db;
  const fmt = RFH.fmt;
  const esc = RFH.esc;
  const icon = RFH.icon;
  RFH.arrancar(main);

  function main() {
  const user = db.requerir("admin");
  if (!user) return;

  const DAY = 86400000;
  const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const hoy = sod(Date.now());
  const ventasEntre = (desde, hasta) => db.ventas.filter((v) => { const t = new Date(v.fecha).getTime(); return t >= desde && t < hasta; });
  const suma = (list) => list.reduce((s, v) => s + v.total, 0);
  const pedidosActivos = () => db.pedidos.filter((o) => ["pendiente", "preparando", "listo"].includes(o.estado));
  const alertasInv = () => db.productos.filter((p) => p.activo && (db.estadoStock(p).key !== "ok" || ((db.estadoCaducidad(p.id) || {}).dias <= 2)));
  const provOptions = () => db.proveedores.map((p) => ({ value: p.id, label: p.nombre }));
  const catOptions = () => db.categorias.map((c) => ({ value: c.id, label: c.nombre }));
  const prodOptions = () => db.productos.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((p) => ({ value: p.id, label: p.nombre + " (" + fmt.unit(p.unidad, 2) + ")" }));
  const num = (v) => parseFloat(String(v).replace(",", "."));
  const prodCell = (p) => '<div class="cell-prod">' + RFH.fruitArt(p) + '<div style="min-width:0"><strong>' + esc(p.nombre) + '</strong><span class="xs muted">' + esc(db.categoria(p.categoria)) + "</span></div></div>";
  const empty = (ico, title, text) => '<div class="empty">' + icon(ico) + "<strong>" + esc(title) + "</strong><span>" + esc(text) + "</span></div>";

  let shell;
  const refresh = () => shell.refresh();

  /* =====================================================
     RESUMEN (dashboard)
     ===================================================== */
  function viewDashboard(el) {
    const vHoy = ventasEntre(hoy, hoy + DAY);
    const v7 = ventasEntre(hoy - 6 * DAY, hoy + DAY);
    const v7prev = ventasEntre(hoy - 13 * DAY, hoy - 6 * DAY);
    const delta = suma(v7prev) ? Math.round(((suma(v7) - suma(v7prev)) / suma(v7prev)) * 100) : 0;
    const act = pedidosActivos();
    const bajos = db.productos.filter((p) => p.activo && db.estadoStock(p).key !== "ok");
    const porCaducar = db.productos.filter((p) => p.activo && db.stock(p.id) > 0 && (db.estadoCaducidad(p.id) || { dias: 99 }).dias <= 2);

    // Serie de 14 días
    const serie = [];
    for (let i = 13; i >= 0; i--) { const d = hoy - i * DAY; const vs = ventasEntre(d, d + DAY); serie.push({ fecha: new Date(d).toISOString(), total: suma(vs), n: vs.length, hoy: i === 0 }); }

    // Top productos (7 días) por ingreso
    const top = {};
    v7.forEach((v) => v.items.forEach((i) => { top[i.productoId] = (top[i.productoId] || 0) + i.cantidad * i.precio; }));
    const topList = Object.keys(top).map((id) => ({ p: db.producto(id), total: top[id] })).filter((x) => x.p).sort((a, b) => b.total - a.total).slice(0, 6);
    const topMax = topList.length ? topList[0].total : 1;

    el.innerHTML =
      '<div class="page-head"><div><h2>Buen día, ' + esc(user.nombre.split(" ")[0]) + '</h2><p>Así va la frutería hoy.</p></div><span class="spacer"></span>' +
      '<a class="btn btn-accent" href="#ventas">' + icon("receipt", "icon-sm") + "Registrar venta</a></div>" +

      '<section class="kpis" aria-label="Indicadores">' +
      kpi("receipt", "", "Ventas de hoy", fmt.money(suma(vHoy)), fmt.plural(vHoy.length, "venta", "ventas")) +
      kpi("trendUp", "", "Últimos 7 días", fmt.money(suma(v7)), (delta >= 0 ? "+" : "") + delta + " % vs. 7 días anteriores") +
      kpi("bag", "accent", "Pedidos por atender", String(act.length), fmt.plural(act.filter((o) => o.estado === "pendiente").length, "nuevo", "nuevos")) +
      kpi("alert", bajos.length ? "warn" : "", "Stock bajo o agotado", String(bajos.length), fmt.plural(porCaducar.length, "producto por caducar", "productos por caducar")) +
      "</section>" +

      '<div class="dash-grid">' +
      '<section class="card" aria-labelledby="ch-t"><div class="card-head"><div><h2 id="ch-t">Ventas por día</h2><p>Últimos 14 días · mostrador y en línea</p></div></div>' +
      '<div class="chart" id="chart"></div>' +
      '<details class="as-table"><summary>Ver como tabla</summary><div class="table-wrap"><table class="table"><thead><tr><th>Día</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead><tbody>' +
      serie.slice().reverse().map((s) => "<tr><td>" + fmt.weekday(s.fecha) + " " + fmt.dateShort(s.fecha) + '</td><td class="num">' + s.n + '</td><td class="num">' + fmt.money(s.total) + "</td></tr>").join("") +
      "</tbody></table></div></details></section>" +

      '<section class="card" aria-labelledby="top-t"><div class="card-head"><div><h2 id="top-t">Más vendidos</h2><p>Ingreso de los últimos 7 días</p></div></div>' +
      (topList.length ? '<div class="hbars">' + topList.map((t) => '<div class="hbar"><span class="hbar-name">' + esc(t.p.nombre) + '</span><span class="hbar-val">' + fmt.money(t.total) + '</span><div class="hbar-track" aria-hidden="true"><span style="width:' + Math.max(4, (t.total / topMax) * 100) + '%"></span></div></div>').join("") + "</div>" : empty("receipt", "Sin ventas", "Aún no hay ventas esta semana.")) +
      "</section>" +

      '<section class="card" aria-labelledby="al-t"><div class="card-head"><div><h2 id="al-t">Alertas de inventario</h2><p>Revisa antes de hacer compras a proveedores</p></div><span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#inventario">Ver inventario' + icon("chevronRight", "icon-sm") + "</a></div>" +
      alertasHtml() + "</section>" +

      '<section class="card" aria-labelledby="pe-t"><div class="card-head"><div><h2 id="pe-t">Pedidos por atender</h2><p>Pedidos en línea de clientes</p></div><span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#pedidos">Ver todos' + icon("chevronRight", "icon-sm") + "</a></div>" +
      (act.length ? '<div class="alert-list">' + act.slice(0, 5).map((o) => {
        const c = db.usuario(o.clienteId) || { nombre: "Cliente" };
        return '<div class="alert-item"><span class="avatar">' + esc(fmt.initials(c.nombre)) + '</span><div class="grow"><strong>' + esc(o.id) + " · " + esc(c.nombre) + '</strong><span class="xs muted">' + fmt.relative(o.fecha) + " · " + fmt.money(o.total) + "</span></div>" + estadoBadge(o.estado) + "</div>";
      }).join("") + "</div>" : empty("checkCircle", "Todo al día", "No hay pedidos pendientes.")) +
      "</section></div>";

    drawBarChart(el.querySelector("#chart"), serie);
  }

  function kpi(ico, tone, label, value, sub) {
    return '<div class="card kpi"><div class="kpi-top"><span class="kpi-ico ' + tone + '">' + icon(ico, "icon-sm") + "</span>" + esc(label) + '</div><div class="value">' + esc(value) + '</div><div class="delta">' + esc(sub) + "</div></div>";
  }

  function alertasHtml() {
    const list = alertasInv().map((p) => ({ p: p, st: db.estadoStock(p), cad: db.estadoCaducidad(p.id) }))
      .sort((a, b) => (a.st.key === "agotado" ? 0 : 1) - (b.st.key === "agotado" ? 0 : 1)).slice(0, 7);
    if (!list.length) return empty("checkCircle", "Sin alertas", "Existencias y caducidades en orden.");
    return '<div class="alert-list">' + list.map(({ p, st, cad }) => {
      const b = st.key !== "ok" ? RFH.badge(st.kind, st.text) : RFH.badge(cad.kind, cad.text);
      return '<div class="alert-item">' + RFH.fruitArt(p) + '<div class="grow"><strong>' + esc(p.nombre) + '</strong><span class="xs muted num">Existencia: ' + fmt.qty(db.stock(p.id), p.unidad) + " · mínimo " + fmt.num(p.stockMinimo) + "</span></div>" + b + "</div>";
    }).join("") + "</div>";
  }

  /* Gráfica de barras de una serie: SVG accesible con tooltip y teclado */
  function drawBarChart(wrap, data) {
    const W = 640, H = 240, L = 56, R = 8, T = 12, B = 30;
    const max = Math.max.apply(null, data.map((d) => d.total)) || 1;
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const cw = (W - L - R) / data.length;
    const bw = Math.min(28, cw * 0.62);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Ventas por día de los últimos 14 días. Máximo ' + fmt.money(max) + '.">';
    for (let g = 0; g <= top; g += step) {
      svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/>';
      svg += '<text class="axis-label" x="' + (L - 8) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + (g >= 1000 ? "$" + g / 1000 + " mil" : "$" + g) + "</text>";
    }
    data.forEach((d, i) => {
      const x = L + i * cw + (cw - bw) / 2;
      const h = Math.max(0, H - B - y(d.total));
      svg += '<rect class="hit" x="' + (L + i * cw) + '" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '" tabindex="0" data-i="' + i + '" aria-label="' + fmt.weekday(d.fecha) + " " + fmt.dateShort(d.fecha) + ": " + fmt.money(d.total) + '"/>';
      svg += '<path class="bar' + (d.hoy ? " is-today" : "") + '" d="' + barPath(x, H - B - h, bw, h, 4) + '"/>';
      if (i % 2 === (data.length - 1) % 2) svg += '<text class="axis-label" x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + (d.hoy ? "Hoy" : fmt.dateShort(d.fecha)) + "</text>";
    });
    svg += "</svg>";
    wrap.innerHTML = svg + '<div class="chart-tip" aria-hidden="true"></div>';
    const tip = wrap.querySelector(".chart-tip");
    const show = (t) => {
      const d = data[+t.dataset.i];
      const box = t.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
      const bar = t.nextElementSibling.getBoundingClientRect();
      tip.innerHTML = fmt.weekday(d.fecha) + " " + fmt.dateShort(d.fecha) + "<b>" + fmt.money(d.total) + "</b>" + fmt.plural(d.n, "venta", "ventas");
      tip.style.left = Math.min(Math.max(box.left - wb.left + box.width / 2, 60), wb.width - 60) + "px";
      tip.style.top = (Math.min(bar.top, box.bottom - 20) - wb.top) + "px";
      tip.classList.add("is-visible");
    };
    const hide = () => tip.classList.remove("is-visible");
    wrap.querySelectorAll(".hit").forEach((t) => {
      t.addEventListener("mouseenter", () => show(t));
      t.addEventListener("focus", () => show(t));
      t.addEventListener("mouseleave", hide);
      t.addEventListener("blur", hide);
    });
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function barPath(x, yy, w, h, r) {
    if (h <= 0) return "";
    r = Math.min(r, w / 2, h);
    return "M" + x + "," + (yy + h) + "V" + (yy + r) + "Q" + x + "," + yy + " " + (x + r) + "," + yy + "H" + (x + w - r) + "Q" + (x + w) + "," + yy + " " + (x + w) + "," + (yy + r) + "V" + (yy + h) + "Z";
  }

  /* =====================================================
     PRODUCTOS
     ===================================================== */
  let prodQ = "", prodCat = "todos";
  function viewProductos(el) {
    el.innerHTML =
      '<div class="page-head"><div><h2>Productos</h2><p>Catálogo, precios y mínimos de existencia.</p></div><span class="spacer"></span>' +
      '<button class="btn btn-primary" type="button" id="btn-new">' + icon("plus", "icon-sm") + "Nuevo producto</button></div>" +
      '<div class="toolbar"><div class="input-icon">' + icon("search") + '<label class="sr-only" for="pq">Buscar producto</label><input class="input" id="pq" type="search" placeholder="Buscar producto…" value="' + esc(prodQ) + '"></div>' +
      '<label class="sr-only" for="pcat">Categoría</label><select class="select" id="pcat" style="width:auto">' +
      [{ value: "todos", label: "Todas las categorías" }].concat(catOptions()).map((o) => '<option value="' + o.value + '"' + (o.value === prodCat ? " selected" : "") + ">" + esc(o.label) + "</option>").join("") + "</select></div>" +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Costo</th><th class="num">Margen</th><th>Existencia</th><th>Proveedor</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody id="tb"></tbody></table></div></div>';

    const tb = el.querySelector("#tb");
    const render = () => {
      const q = prodQ.toLowerCase();
      const list = db.productos.filter((p) => (prodCat === "todos" || p.categoria === prodCat) && (!q || p.nombre.toLowerCase().includes(q)));
      tb.innerHTML = list.length ? list.map((p) => {
        const st = db.estadoStock(p);
        const margen = p.precio ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0;
        const prov = db.proveedor(p.proveedorId);
        return "<tr>" +
          "<td>" + prodCell(p) + "</td>" +
          '<td class="num">' + fmt.money(p.precio) + '<span class="xs muted"> /' + fmt.unit(p.unidad, 1) + "</span></td>" +
          '<td class="num">' + fmt.money(p.costo) + "</td>" +
          '<td class="num">' + margen + " %</td>" +
          '<td><div class="stack" style="gap:4px"><span class="num small nowrap">' + fmt.qty(db.stock(p.id), p.unidad) + "</span>" + RFH.badge(st.kind, st.text) + "</div></td>" +
          '<td class="small"><span class="truncate" style="display:block;max-width:22ch">' + esc(prov ? prov.nombre : "—") + "</span></td>" +
          "<td>" + (p.activo ? RFH.badge("ok", "Visible") : '<span class="badge">' + icon("eye") + "Oculto</span>") + "</td>" +
          '<td><div class="actions"><button class="btn btn-ghost btn-icon btn-sm" type="button" data-edit="' + p.id + '" aria-label="Editar ' + esc(p.nombre) + '">' + icon("pencil", "icon-sm") + "</button>" +
          '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-del="' + p.id + '" aria-label="Eliminar ' + esc(p.nombre) + '">' + icon("trash", "icon-sm") + "</button></div></td></tr>";
      }).join("") : '<tr><td colspan="8">' + empty("search", "Sin resultados", "No hay productos con ese filtro.") + "</td></tr>";
    };
    render();
    el.querySelector("#pq").addEventListener("input", (e) => { prodQ = e.target.value; render(); });
    el.querySelector("#pcat").addEventListener("change", (e) => { prodCat = e.target.value; render(); });
    el.querySelector("#btn-new").addEventListener("click", () => productoForm(null, render));
    tb.addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) productoForm(db.producto(ed.dataset.edit), render);
      if (del) {
        const p = db.producto(del.dataset.del);
        RFH.confirm("¿Eliminar " + p.nombre + "?", "Se quitará del catálogo. Si solo quieres dejar de venderlo por ahora, mejor márcalo como oculto.", "Eliminar", async () => { await db.eliminarProducto(p.id); RFH.toast(p.nombre + " eliminado"); render(); });
      }
    });
  }

  function productoForm(p, done) {
    const isNew = !p;
    p = p || { nombre: "", categoria: "frutas", unidad: "kg", precio: "", costo: "", stockMinimo: 5, vidaDias: 7, proveedorId: (db.proveedores[0] || {}).id || "", activo: true, destacado: false, imagen: "" };
    RFH.modal({
      title: isNew ? "Nuevo producto" : "Editar producto",
      okText: isNew ? "Agregar producto" : "Guardar cambios",
      body: '<div class="form-grid cols-2">' +
        RFH.field({ name: "nombre", label: "Nombre", value: p.nombre, span: true }) +
        RFH.field({ name: "categoria", label: "Categoría", type: "select", value: p.categoria, options: catOptions() }) +
        RFH.field({ name: "unidad", label: "Se vende por", type: "select", value: p.unidad, options: [{ value: "kg", label: "Kilo" }, { value: "pieza", label: "Pieza" }, { value: "manojo", label: "Manojo" }] }) +
        RFH.field({ name: "precio", label: "Precio de venta (MXN)", value: p.precio, attrs: 'inputmode="decimal"' }) +
        RFH.field({ name: "costo", label: "Costo de compra (MXN)", value: p.costo, attrs: 'inputmode="decimal"' }) +
        RFH.field({ name: "stockMinimo", label: "Existencia mínima", value: p.stockMinimo, attrs: 'inputmode="decimal"', hint: "Debajo de esto se marca «Stock bajo»." }) +
        RFH.field({ name: "vidaDias", label: "Vida de anaquel (días)", value: p.vidaDias, attrs: 'inputmode="numeric"', hint: "Para sugerir la fecha de caducidad." }) +
        RFH.field({ name: "proveedorId", label: "Proveedor principal", type: "select", value: p.proveedorId, options: provOptions(), span: true }) +
        RFH.field({ name: "activo", label: "Visible en el catálogo", type: "select", value: String(p.activo), options: [{ value: "true", label: "Sí" }, { value: "false", label: "No, ocultar" }] }) +
        RFH.field({ name: "destacado", label: "Destacado en portada", type: "select", value: String(p.destacado), options: [{ value: "false", label: "No" }, { value: "true", label: "Sí" }] }) +
        RFH.field({ name: "imagen", label: "Foto (opcional)", value: p.imagen || "", span: true, attrs: 'placeholder="assets/img/productos/mango.jpg o https://…"', hint: "Ruta dentro de assets/img/ o una URL https. Sin foto se usa una ilustración." }) +
        "</div>",
      onSubmit: async (f) => {
        const ok = RFH.validate(f, {
          nombre: (v) => v.length < 2 ? "Escribe el nombre del producto." : db.productos.some((x) => x.id !== p.id && x.nombre.toLowerCase() === v.toLowerCase()) ? "Ya existe un producto con ese nombre." : "",
          precio: (v) => !(num(v) > 0) ? "El precio debe ser mayor a 0." : "",
          costo: (v) => !(num(v) >= 0) ? "Escribe el costo (puede ser 0)." : num(v) > num(f.precio.value) ? "El costo es mayor que el precio: venderías con pérdida." : "",
          stockMinimo: (v) => !(num(v) >= 0) ? "Escribe un número." : "",
          vidaDias: (v) => !(parseInt(v, 10) > 0) ? "Escribe los días (mínimo 1)." : "",
          imagen: (v) => v && !/^(assets\/img\/[\w\-/]+\.(jpe?g|png|webp)|https:\/\/\S+)$/i.test(v) ? "Usa una ruta de assets/img/ o una URL que empiece con https://" : ""
        });
        if (!ok) return false;
        await db.guardarProducto({
          id: isNew ? "" : p.id,
          nombre: f.nombre.value.trim(), categoria: f.categoria.value, unidad: f.unidad.value, precio: num(f.precio.value), costo: num(f.costo.value),
          stockMinimo: num(f.stockMinimo.value), vidaDias: parseInt(f.vidaDias.value, 10), proveedorId: f.proveedorId.value,
          activo: f.activo.value === "true", destacado: f.destacado.value === "true", imagen: f.imagen.value.trim()
        });
        RFH.toast(isNew ? "Producto agregado" : "Cambios guardados");
        done();
      }
    });
  }

  /* =====================================================
     INVENTARIO (lotes, caducidad, PEPS, mermas)
     ===================================================== */
  let invFiltro = "todos";
  function viewInventario(el) {
    const activos = db.productos.filter((p) => p.activo);
    const grupos = {
      todos: activos,
      bajo: activos.filter((p) => db.estadoStock(p).key === "bajo"),
      agotado: activos.filter((p) => db.estadoStock(p).key === "agotado"),
      caducar: activos.filter((p) => db.stock(p.id) > 0 && (db.estadoCaducidad(p.id) || { dias: 99 }).dias <= 2)
    };
    const nombres = { todos: "Todos", bajo: "Stock bajo", caducar: "Por caducar", agotado: "Agotados" };
    const list = grupos[invFiltro];
    el.innerHTML =
      '<div class="page-head"><div><h2>Inventario</h2><p>Existencias por lote. Las salidas se descuentan del lote que caduca primero (PEPS).</p></div><span class="spacer"></span>' +
      '<button class="btn" type="button" id="btn-merma">' + icon("trendDown", "icon-sm") + "Registrar merma</button>" +
      '<button class="btn btn-primary" type="button" id="btn-entrada">' + icon("plus", "icon-sm") + "Registrar entrada</button></div>" +
      '<div class="chips" role="group" aria-label="Filtrar inventario" style="margin-bottom:var(--s-4)">' +
      Object.keys(nombres).map((k) => '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (k === invFiltro) + '">' + nombres[k] + '<span class="count">' + grupos[k].length + "</span></button>").join("") + "</div>" +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th>Existencia vs. mínimo</th><th class="num">Apartado</th><th class="num">Disponible</th><th>Caduca primero</th><th class="num">Lotes</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
      (list.length ? list.map((p) => {
        const s = db.stock(p.id), st = db.estadoStock(p), cad = db.estadoCaducidad(p.id);
        const pct = Math.min(100, (s / Math.max(p.stockMinimo * 2, 1)) * 100);
        return "<tr><td>" + prodCell(p) + "</td>" +
          '<td style="min-width:180px"><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="num small nowrap" style="min-width:70px">' + fmt.qty(s, p.unidad) + '</span><div class="meter ' + (st.kind === "ok" ? "" : st.kind) + '" style="flex:1" aria-hidden="true"><span style="width:' + pct + '%"></span></div></div><div style="margin-top:4px">' + RFH.badge(st.kind, st.text + " · mín. " + fmt.num(p.stockMinimo)) + "</div></td>" +
          '<td class="num">' + fmt.num(db.reservado(p.id)) + "</td>" +
          '<td class="num"><strong>' + fmt.num(db.disponible(p.id)) + "</strong></td>" +
          "<td>" + (cad ? RFH.badge(cad.kind, cad.text) + '<div class="xs muted" style="margin-top:4px">' + fmt.date(db.proximaCaducidad(p.id)) + "</div>" : '<span class="muted small">Sin lotes</span>') + "</td>" +
          '<td class="num">' + db.lotesDe(p.id).length + "</td>" +
          '<td><div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-lotes="' + p.id + '">Lotes</button>' +
          '<button class="btn btn-soft btn-icon btn-sm" type="button" data-in="' + p.id + '" aria-label="Registrar entrada de ' + esc(p.nombre) + '">' + icon("plus", "icon-sm") + "</button></div></td></tr>";
      }).join("") : '<tr><td colspan="7">' + empty("checkCircle", "Nada por aquí", "Ningún producto cumple este filtro.") + "</td></tr>") +
      "</tbody></table></div></div>" +
      '<section class="card" style="margin-top:var(--s-4)" aria-labelledby="mer-t"><div class="card-head"><div><h2 id="mer-t">Mermas registradas</h2><p>Producto que se tiró por daño o caducidad. Ayuda a ajustar las compras.</p></div></div>' +
      (db.mermas.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th class="num">Cantidad</th><th>Motivo</th><th class="num">Costo perdido</th></tr></thead><tbody>' +
        db.mermas.slice(0, 15).map((m) => { const p = db.producto(m.productoId) || { nombre: "—", unidad: "kg", costo: 0 }; return "<tr><td>" + fmt.dateTime(m.fecha) + "</td><td>" + esc(p.nombre) + '</td><td class="num">' + fmt.qty(m.cantidad, p.unidad) + "</td><td>" + esc(m.motivo) + '</td><td class="num">' + fmt.money(m.cantidad * p.costo) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : empty("leaf", "Sin mermas registradas", "Cuando algo se eche a perder, regístralo con «Registrar merma».")) +
      "</section>";

    el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { invFiltro = b.dataset.f; refresh(); }));
    el.querySelector("#btn-entrada").addEventListener("click", () => entradaForm(null));
    el.querySelector("#btn-merma").addEventListener("click", () => mermaForm());
    el.querySelector("tbody").addEventListener("click", (e) => {
      const lo = e.target.closest("[data-lotes]"), inn = e.target.closest("[data-in]");
      if (lo) lotesModal(db.producto(lo.dataset.lotes));
      if (inn) entradaForm(inn.dataset.in);
    });
  }

  function entradaForm(pid) {
    const p0 = db.producto(pid) || db.productos.filter((p) => p.activo)[0];
    const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); // fecha local, no UTC
    const cadDefault = (p) => ymd(new Date(Date.now() + p.vidaDias * DAY));
    RFH.modal({
      title: "Registrar entrada de mercancía",
      okText: "Registrar entrada",
      body: '<div class="form-grid cols-2">' +
        RFH.field({ name: "productoId", label: "Producto", type: "select", value: p0.id, options: prodOptions(), span: true }) +
        RFH.field({ name: "cantidad", label: "Cantidad recibida", attrs: 'inputmode="decimal"', hint: "En la unidad del producto." }) +
        RFH.field({ name: "costo", label: "Costo unitario (MXN)", value: p0.costo, attrs: 'inputmode="decimal"' }) +
        RFH.field({ name: "proveedorId", label: "Proveedor", type: "select", value: p0.proveedorId, options: provOptions() }) +
        RFH.field({ name: "caducidad", label: "Caducidad estimada", type: "date", value: cadDefault(p0), attrs: 'min="' + ymd(new Date()) + '"' }) +
        "</div>",
      onOpen: (f) => {
        f.productoId.addEventListener("change", () => { const p = db.producto(f.productoId.value); f.costo.value = p.costo; f.proveedorId.value = p.proveedorId; f.caducidad.value = cadDefault(p); });
      },
      onSubmit: async (f) => {
        const ok = RFH.validate(f, {
          cantidad: (v) => !(num(v) > 0) ? "Escribe cuánto llegó (mayor a 0)." : "",
          costo: (v) => !(num(v) >= 0) ? "Escribe el costo unitario." : "",
          caducidad: (v) => !v ? "Indica la fecha de caducidad." : ""
        });
        if (!ok) return false;
        const p = db.producto(f.productoId.value);
        await db.registrarEntrada({ productoId: p.id, cantidad: num(f.cantidad.value), costo: num(f.costo.value), proveedorId: f.proveedorId.value, caducidad: f.caducidad.value });
        RFH.toast("Entrada registrada: " + fmt.qty(num(f.cantidad.value), p.unidad) + " de " + p.nombre);
        refresh();
      }
    });
  }

  function mermaForm() {
    RFH.modal({
      title: "Registrar merma",
      okText: "Registrar merma",
      danger: true,
      body: '<div class="form-grid cols-2">' +
        RFH.field({ name: "productoId", label: "Producto", type: "select", options: prodOptions().filter((o) => db.stock(o.value) > 0), span: true }) +
        RFH.field({ name: "cantidad", label: "Cantidad", attrs: 'inputmode="decimal"', hint: "Se descuenta del lote más próximo a caducar." }) +
        RFH.field({ name: "motivo", label: "Motivo", type: "select", options: ["Caducó", "Golpeado / dañado", "Plaga u hongo", "Otro"].map((m) => ({ value: m, label: m })) }) +
        "</div>",
      onSubmit: async (f) => {
        const p = db.producto(f.productoId.value);
        const ok = RFH.validate(f, { cantidad: (v) => !(num(v) > 0) ? "Escribe la cantidad." : num(v) > db.stock(p.id) ? "No puede ser mayor a la existencia (" + fmt.qty(db.stock(p.id), p.unidad) + ")." : "" });
        if (!ok) return false;
        await db.registrarMerma(p.id, num(f.cantidad.value), f.motivo.value);
        RFH.toast("Merma registrada");
        refresh();
      }
    });
  }

  function lotesModal(p) {
    const lotes = db.lotesDe(p.id);
    const dlg = RFH.modal({
      title: "Lotes de " + p.nombre,
      okText: "Listo",
      body: '<p class="small muted" style="margin-bottom:var(--s-3)">Orden de salida PEPS: el primero de la lista es el que se vende primero.</p>' +
        (lotes.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Entrada</th><th>Caducidad</th><th class="num">Queda</th><th>Proveedor</th></tr></thead><tbody>' +
          lotes.map((l, i) => { const d = db.diasPara(l.caducidad); const k = d < 0 ? "crit" : d <= 2 ? "warn" : "ok"; return '<tr><td class="num">' + (i + 1) + "</td><td>" + fmt.dateShort(l.entrada) + "</td><td>" + RFH.badge(k, fmt.dateShort(l.caducidad)) + '</td><td class="num">' + fmt.qty(l.cantidad, p.unidad) + '</td><td class="small">' + esc((db.proveedor(l.proveedorId) || {}).nombre || "—") + "</td></tr>"; }).join("") +
          "</tbody></table></div>" : empty("package", "Sin existencias", "Registra una entrada para crear un lote."))
    });
    dlg.querySelector("[data-close].btn-ghost:not(.btn-icon)").remove();
  }

  /* =====================================================
     PROVEEDORES
     ===================================================== */
  function viewProveedores(el) {
    el.innerHTML =
      '<div class="page-head"><div><h2>Proveedores</h2><p>Contactos, días de entrega y compras recibidas.</p></div><span class="spacer"></span>' +
      '<button class="btn btn-primary" type="button" id="btn-new">' + icon("plus", "icon-sm") + "Nuevo proveedor</button></div>" +
      '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));margin-bottom:var(--s-4)">' +
      db.proveedores.map((pv) => {
        const prods = db.productos.filter((p) => p.proveedorId === pv.id).length;
        const ult = db.compras.find((c) => c.proveedorId === pv.id);
        return '<article class="card stack" style="gap:var(--s-3)">' +
          '<div class="row" style="flex-wrap:nowrap"><span class="kpi-ico" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--c-primary-soft);color:var(--c-primary);flex-shrink:0">' + icon("truck") + '</span><div style="min-width:0;flex:1"><h3 class="truncate" style="display:block">' + esc(pv.nombre) + '</h3><span class="small muted">' + esc(pv.contacto) + "</span></div>" +
          '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-edit="' + pv.id + '" aria-label="Editar ' + esc(pv.nombre) + '">' + icon("pencil", "icon-sm") + "</button></div>" +
          '<div class="row" style="gap:6px">' + pv.categorias.map((c) => '<span class="badge">' + esc(db.categoria(c)) + "</span>").join("") + (pv.activo ? "" : RFH.badge("crit", "Inactivo")) + "</div>" +
          '<div class="small stack" style="gap:6px">' +
          '<span class="row" style="gap:8px">' + icon("phone", "icon-sm") + '<a href="tel:' + esc(pv.telefono.replace(/\s/g, "")) + '">' + esc(pv.telefono) + "</a></span>" +
          '<span class="row" style="gap:8px;flex-wrap:nowrap">' + icon("mail", "icon-sm") + '<a class="truncate" href="mailto:' + esc(pv.email) + '">' + esc(pv.email) + "</a></span>" +
          '<span class="row" style="gap:8px">' + icon("calendar", "icon-sm") + "Entrega: " + esc(pv.diasEntrega) + "</span></div>" +
          '<div class="row small muted" style="border-top:1px solid var(--c-line);padding-top:var(--s-3)"><span>' + fmt.plural(prods, "producto", "productos") + '</span><span class="spacer"></span><span>Última compra: ' + (ult ? fmt.dateShort(ult.fecha) : "—") + "</span></div>" +
          "</article>";
      }).join("") + "</div>" +
      '<section class="card" aria-labelledby="co-t"><div class="card-head"><div><h2 id="co-t">Compras recibidas</h2><p>Cada entrada de mercancía genera una compra.</p></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Productos</th><th class="num">Total</th><th>Estado</th></tr></thead><tbody>' +
      db.compras.slice(0, 12).map((c) => "<tr><td class=\"nowrap\">" + fmt.date(c.fecha) + "</td><td>" + esc((db.proveedor(c.proveedorId) || {}).nombre || "—") + '</td><td class="small">' + c.items.map((i) => { const p = db.producto(i.productoId); return p ? esc(p.nombre) + " × " + fmt.num(i.cantidad) : ""; }).join(", ") + '</td><td class="num">' + fmt.money(c.total) + "</td><td>" + RFH.badge("ok", "Recibida") + "</td></tr>").join("") +
      "</tbody></table></div></section>";

    el.querySelector("#btn-new").addEventListener("click", () => proveedorForm(null));
    el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => proveedorForm(db.proveedor(b.dataset.edit))));
  }

  function proveedorForm(pv) {
    const isNew = !pv;
    pv = pv || { nombre: "", contacto: "", telefono: "", email: "", categorias: [], diasEntrega: "", activo: true, notas: "" };
    RFH.modal({
      title: isNew ? "Nuevo proveedor" : "Editar proveedor",
      okText: isNew ? "Agregar proveedor" : "Guardar cambios",
      body: '<div class="form-grid cols-2">' +
        RFH.field({ name: "nombre", label: "Nombre o razón social", value: pv.nombre, span: true }) +
        RFH.field({ name: "contacto", label: "Persona de contacto", value: pv.contacto }) +
        RFH.field({ name: "telefono", label: "Teléfono", value: pv.telefono, type: "tel", attrs: 'inputmode="tel"' }) +
        RFH.field({ name: "email", label: "Correo", value: pv.email, type: "email", attrs: 'inputmode="email"' }) +
        RFH.field({ name: "diasEntrega", label: "Días de entrega", value: pv.diasEntrega, hint: "Ej. Lun, Mié, Vie" }) +
        '<fieldset class="field span-2" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:6px">Qué surte</legend><div class="row">' +
        db.categorias.map((c) => '<label class="chip" style="display:inline-flex;align-items:center;gap:8px"><input type="checkbox" name="cat" value="' + c.id + '"' + (pv.categorias.includes(c.id) ? " checked" : "") + ">" + esc(c.nombre) + "</label>").join("") +
        "</div></fieldset>" +
        RFH.field({ name: "activo", label: "Estado", type: "select", value: String(pv.activo), options: [{ value: "true", label: "Activo" }, { value: "false", label: "Inactivo" }] }) +
        RFH.field({ name: "notas", label: "Notas", type: "textarea", value: pv.notas, span: true }) +
        "</div>",
      onSubmit: async (f) => {
        const ok = RFH.validate(f, {
          nombre: (v) => v.length < 3 ? "Escribe el nombre del proveedor." : "",
          telefono: (v) => v.replace(/\D/g, "").length !== 10 ? "El teléfono debe tener 10 dígitos." : "",
          email: (v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Revisa el correo." : ""
        });
        if (!ok) return false;
        await db.guardarProveedor({
          id: isNew ? "" : pv.id,
          nombre: f.nombre.value.trim(), contacto: f.contacto.value.trim(), telefono: f.telefono.value.trim(), email: f.email.value.trim(),
          diasEntrega: f.diasEntrega.value.trim(), activo: f.activo.value === "true", notas: f.notas.value.trim(),
          categorias: Array.from(f.querySelectorAll('[name="cat"]:checked')).map((c) => c.value)
        });
        RFH.toast(isNew ? "Proveedor agregado" : "Cambios guardados");
        refresh();
      }
    });
  }

  /* =====================================================
     PEDIDOS EN LÍNEA
     ===================================================== */
  const ESTADOS = { pendiente: ["info", "Nuevo"], preparando: ["accent", "Preparando"], listo: ["ok", "Listo"], entregado: ["ok", "Entregado"], cancelado: ["crit", "Cancelado"] };
  const SIGUIENTE = { pendiente: ["preparando", "Empezar a preparar"], preparando: ["listo", "Marcar listo"], listo: ["entregado", "Marcar entregado"] };
  const estadoBadge = (e) => RFH.badge(ESTADOS[e][0], ESTADOS[e][1]);
  let pedFiltro = "activos";

  function viewPedidos(el) {
    const grupos = {
      activos: pedidosActivos(),
      pendiente: db.pedidos.filter((o) => o.estado === "pendiente"),
      preparando: db.pedidos.filter((o) => o.estado === "preparando"),
      listo: db.pedidos.filter((o) => o.estado === "listo"),
      entregado: db.pedidos.filter((o) => o.estado === "entregado"),
      cancelado: db.pedidos.filter((o) => o.estado === "cancelado"),
      todos: db.pedidos
    };
    const nombres = { activos: "Por atender", pendiente: "Nuevos", preparando: "Preparando", listo: "Listos", entregado: "Entregados", cancelado: "Cancelados", todos: "Todos" };
    const list = grupos[pedFiltro];
    el.innerHTML =
      '<div class="page-head"><div><h2>Pedidos en línea</h2><p>Avanza cada pedido: Nuevo → Preparando → Listo → Entregado. Al entregarlo se registra la venta y se descuenta el inventario.</p></div></div>' +
      '<div class="chips" role="group" aria-label="Filtrar pedidos" style="margin-bottom:var(--s-4)">' +
      Object.keys(nombres).map((k) => '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (k === pedFiltro) + '">' + nombres[k] + '<span class="count">' + grupos[k].length + "</span></button>").join("") + "</div>" +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Recibido</th><th>Entrega</th><th class="num">Total</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
      (list.length ? list.map((o) => {
        const c = db.usuario(o.clienteId) || { nombre: "Cliente eliminado", email: "" };
        const sig = SIGUIENTE[o.estado];
        return '<tr><td><strong class="num">' + esc(o.id) + '</strong><div class="xs muted">' + fmt.plural(o.items.length, "producto", "productos") + "</div></td>" +
          '<td><div class="truncate" style="max-width:22ch;font-weight:700">' + esc(c.nombre) + '</div><div class="xs muted truncate" style="max-width:24ch">' + esc(c.telefono || c.email) + "</div></td>" +
          '<td class="nowrap small">' + fmt.relative(o.fecha) + "</td>" +
          '<td class="small">' + (o.entrega === "domicilio" ? icon("truck", "icon-sm") + " Domicilio" : icon("store", "icon-sm") + " Recoger") + "</td>" +
          '<td class="num">' + fmt.money(o.total) + "</td>" +
          "<td>" + estadoBadge(o.estado) + "</td>" +
          '<td><div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-ver="' + o.id + '">Ver</button>' +
          (sig ? '<button class="btn btn-primary btn-sm" type="button" data-next="' + o.id + '">' + sig[1] + "</button>" : "") + "</div></td></tr>";
      }).join("") : '<tr><td colspan="7">' + empty("checkCircle", "Sin pedidos aquí", "No hay pedidos con este estado.") + "</td></tr>") +
      "</tbody></table></div></div>";

    el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { pedFiltro = b.dataset.f; refresh(); }));
    el.querySelector("tbody").addEventListener("click", (e) => {
      const nx = e.target.closest("[data-next]"), ver = e.target.closest("[data-ver]");
      if (nx) avanzar(nx.dataset.next, nx);
      if (ver) pedidoModal(db.pedidos.find((o) => o.id === ver.dataset.ver));
    });
  }

  async function avanzar(id, btn) {
    const o = db.pedidos.find((x) => x.id === id);
    const sig = SIGUIENTE[o.estado];
    if (sig[0] === "entregado") {
      const falta = o.items.find((i) => db.stock(i.productoId) < i.cantidad);
      if (falta) { RFH.toast("No alcanza la existencia de " + falta.nombre + ". Registra una entrada.", "error"); return; }
    }
    if (btn) btn.disabled = true;
    try {
      await db.cambiarEstado(id, sig[0]);
      RFH.toast(id + ": " + ESTADOS[sig[0]][1]);
    } catch (err) {
      RFH.toast(err.message, "error");
    }
    refresh();
  }

  function pedidoModal(o) {
    const c = db.usuario(o.clienteId) || { nombre: "—", email: "", telefono: "" };
    const sig = SIGUIENTE[o.estado];
    RFH.modal({
      title: "Pedido " + o.id,
      okText: sig ? sig[1] : "Cerrar",
      cancelText: o.estado === "pendiente" ? "Cancelar pedido" : "Cerrar",
      body: '<div class="stack">' +
        '<div class="row">' + estadoBadge(o.estado) + '<span class="small muted">' + fmt.dateTime(o.fecha) + " · " + (o.entrega === "domicilio" ? "A domicilio" : "Recoger en tienda") + "</span></div>" +
        '<div class="user-chip"><span class="avatar">' + esc(fmt.initials(c.nombre)) + "</span><div><strong>" + esc(c.nombre) + "</strong><span>" + esc([c.telefono, c.email].filter(Boolean).join(" · ")) + "</span></div></div>" +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead><tbody>' +
        o.items.map((i) => "<tr><td>" + esc(i.nombre) + '</td><td class="num">' + fmt.qty(i.cantidad, i.unidad) + '</td><td class="num">' + fmt.money(i.cantidad * i.precio) + "</td></tr>").join("") +
        '</tbody></table></div><div class="summary-row total"><span>Total</span><span>' + fmt.money(o.total) + "</span></div>" +
        (o.direccion ? '<p class="small"><strong>Entregar en:</strong> ' + esc(o.direccion) + "</p>" : "") +
        (o.notas ? '<p class="small"><strong>Notas:</strong> ' + esc(o.notas) + "</p>" : "") + "</div>",
      onOpen: (f, dlg) => {
        const cancel = dlg.querySelector(".modal-foot [data-close]");
        if (!sig) { cancel.remove(); return; }
        if (o.estado !== "pendiente") return;
        cancel.addEventListener("click", async () => {
          try { await db.cambiarEstado(o.id, "cancelado"); RFH.toast(o.id + " cancelado"); } catch (err) { RFH.toast(err.message, "error"); }
          refresh();
        });
      },
      onSubmit: async () => { if (sig) await avanzar(o.id); }
    });
  }

  /* =====================================================
     VENTAS (punto de venta de mostrador + historial)
     ===================================================== */
  let ticket = {};
  let posQ = "";
  let rango = "hoy";
  function viewVentas(el) {
    el.innerHTML =
      '<div class="page-head"><div><h2>Punto de venta</h2><p>Registra las ventas de mostrador. Toca un producto para agregarlo al ticket.</p></div></div>' +
      '<div class="pos">' +
      '<div><div class="toolbar"><div class="input-icon">' + icon("search") + '<label class="sr-only" for="posq">Buscar producto</label><input class="input" id="posq" type="search" placeholder="Buscar producto…" value="' + esc(posQ) + '"></div></div><div class="pos-grid" id="pos-grid"></div></div>' +
      '<aside class="card ticket" aria-labelledby="tk-t"><div class="card-head"><h2 id="tk-t">Ticket</h2><span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" id="tk-clear">Vaciar</button></div><div id="tk"></div></aside>' +
      "</div>" +
      '<section class="card" style="margin-top:var(--s-6)" aria-labelledby="hv-t"><div class="card-head"><div><h2 id="hv-t">Historial de ventas</h2><p id="hv-sum"></p></div><span class="spacer"></span>' +
      '<div class="segmented" role="radiogroup" aria-label="Periodo">' + [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"]].map((r) => '<label><input type="radio" name="rango" value="' + r[0] + '"' + (r[0] === rango ? " checked" : "") + "><span>" + r[1] + "</span></label>").join("") + "</div></div>" +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Folio</th><th>Fecha</th><th>Canal</th><th>Productos</th><th>Pago</th><th class="num">Total</th></tr></thead><tbody id="hv"></tbody></table></div></section>';

    const grid = el.querySelector("#pos-grid");
    const renderGrid = () => {
      const q = posQ.toLowerCase();
      const list = db.productos.filter((p) => p.activo && (!q || p.nombre.toLowerCase().includes(q)));
      grid.innerHTML = list.length ? list.map((p) => {
        const s = db.stock(p.id) - (ticket[p.id] || 0);
        return '<button class="pos-item" type="button" data-p="' + p.id + '"' + (s <= 0 ? " disabled" : "") + ">" + RFH.fruitArt(p) + "<strong>" + esc(p.nombre) + '</strong><span class="small num">' + fmt.money(p.precio) + " / " + fmt.unit(p.unidad, 1) + '</span><span class="xs muted num">' + (s <= 0 ? "Sin existencia" : "Hay " + fmt.qty(Math.round(s * 100) / 100, p.unidad)) + "</span></button>";
      }).join("") : empty("search", "Sin resultados", "Prueba otro nombre.");
    };
    const renderTicket = () => {
      const ids = Object.keys(ticket);
      const total = ids.reduce((s, id) => s + ticket[id] * db.producto(id).precio, 0);
      el.querySelector("#tk").innerHTML = ids.length
        ? '<div class="ticket-lines">' + ids.map((id) => {
          const p = db.producto(id);
          return '<div class="ticket-line"><span class="truncate">' + esc(p.nombre) + '</span><span class="num">' + fmt.money(ticket[id] * p.precio) + "</span>" +
            '<div class="row" style="gap:8px"><div class="stepper" role="group" aria-label="Cantidad de ' + esc(p.nombre) + '"><button type="button" data-dec="' + id + '" aria-label="Quitar">' + icon("minus", "icon-sm") + "</button><output>" + fmt.num(ticket[id]) + '</output><button type="button" data-inc="' + id + '" aria-label="Agregar más">' + icon("plus", "icon-sm") + '</button></div><span class="xs muted">' + fmt.unit(p.unidad, ticket[id]) + " × " + fmt.money(p.precio) + "</span></div></div>";
        }).join("") + "</div>" +
          '<div class="ticket-total"><span class="muted">Total</span><span class="price">' + fmt.money(total) + "</span></div>" +
          '<div class="stack" style="gap:var(--s-3)"><div class="segmented" role="radiogroup" aria-label="Forma de pago"><label><input type="radio" name="metodo" value="efectivo" checked><span>Efectivo</span></label><label><input type="radio" name="metodo" value="tarjeta"><span>Tarjeta</span></label></div>' +
          '<button class="btn btn-accent btn-block" type="button" id="tk-cobrar">' + icon("check", "icon-sm") + "Cobrar " + fmt.money(total) + "</button></div>"
        : empty("receipt", "Ticket vacío", "Toca productos de la izquierda para empezar.");
    };
    const renderHist = () => {
      const desde = rango === "hoy" ? hoy : hoy - (parseInt(rango, 10) - 1) * DAY;
      const vs = ventasEntre(desde, hoy + DAY);
      el.querySelector("#hv-sum").textContent = fmt.plural(vs.length, "venta", "ventas") + " · " + fmt.money(suma(vs));
      el.querySelector("#hv").innerHTML = vs.length ? vs.slice(0, 60).map((v) =>
        '<tr><td class="num">' + esc(v.id.toUpperCase()) + '</td><td class="nowrap small">' + fmt.dateTime(v.fecha) + "</td><td>" + (v.canal === "en_linea" ? RFH.badge("info", "En línea") : '<span class="badge">' + icon("store") + "Mostrador</span>") + "</td>" +
        '<td class="small"><span class="truncate" style="display:block;max-width:34ch">' + v.items.map((i) => esc(i.nombre) + " × " + fmt.num(i.cantidad)).join(", ") + '</span></td><td class="small">' + (v.metodo === "tarjeta" ? "Tarjeta" : "Efectivo") + '</td><td class="num"><strong>' + fmt.money(v.total) + "</strong></td></tr>").join("")
        : '<tr><td colspan="6">' + empty("receipt", "Sin ventas en este periodo", "Las ventas que registres aparecerán aquí.") + "</td></tr>";
    };
    renderGrid(); renderTicket(); renderHist();

    const paso = (p) => (p.unidad === "kg" ? 0.5 : 1);
    el.querySelector("#posq").addEventListener("input", (e) => { posQ = e.target.value; renderGrid(); });
    grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-p]");
      if (!b) return;
      const p = db.producto(b.dataset.p);
      ticket[p.id] = Math.min(db.stock(p.id), (ticket[p.id] || 0) + paso(p));
      renderGrid(); renderTicket();
      const again = grid.querySelector('[data-p="' + p.id + '"]'); if (again && !again.disabled) again.focus();
    });
    el.querySelector("#tk").addEventListener("click", (e) => {
      const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
      if (inc || dec) {
        const id = (inc || dec).dataset.inc || (inc || dec).dataset.dec;
        const p = db.producto(id);
        const q = Math.round(((ticket[id] || 0) + (inc ? paso(p) : -paso(p))) * 2) / 2;
        if (q > db.stock(id)) { RFH.toast("No hay más existencia de " + p.nombre, "error"); return; }
        if (q <= 0) delete ticket[id]; else ticket[id] = q;
        renderGrid(); renderTicket();
      }
      const cobrar = e.target.closest("#tk-cobrar");
      if (cobrar && !cobrar.disabled) {
        const metodo = el.querySelector('[name="metodo"]:checked').value;
        const items = Object.keys(ticket).map((id) => ({ productoId: id, cantidad: ticket[id] }));
        cobrar.disabled = true;
        cobrar.textContent = "Registrando…";
        db.registrarVenta({ items: items, metodo: metodo }).then((v) => {
          ticket = {};
          RFH.toast("Venta " + v.id + " registrada por " + fmt.money(v.total));
        }).catch((err) => RFH.toast(err.message, "error"))
          .finally(() => { renderGrid(); renderTicket(); renderHist(); });
      }
    });
    el.querySelector("#tk-clear").addEventListener("click", () => { ticket = {}; renderGrid(); renderTicket(); });
    el.querySelectorAll('[name="rango"]').forEach((r) => r.addEventListener("change", () => { rango = r.value; renderHist(); }));
  }

  /* =====================================================
     USUARIOS
     ===================================================== */
  let usrRol = "todos";
  function viewUsuarios(el) {
    const list = db.usuarios.filter((u) => usrRol === "todos" || u.rol === usrRol);
    el.innerHTML =
      '<div class="page-head"><div><h2>Usuarios</h2><p>Clientes registrados y personal con acceso al panel.</p></div><span class="spacer"></span>' +
      '<button class="btn btn-primary" type="button" id="btn-new">' + icon("plus", "icon-sm") + "Nuevo usuario</button></div>" +
      '<div class="chips" role="group" aria-label="Filtrar por rol" style="margin-bottom:var(--s-4)">' +
      [["todos", "Todos"], ["cliente", "Clientes"], ["admin", "Administradores"]].map((r) => '<button class="chip" type="button" data-f="' + r[0] + '" aria-pressed="' + (r[0] === usrRol) + '">' + r[1] + '<span class="count">' + db.usuarios.filter((u) => r[0] === "todos" || u.rol === r[0]).length + "</span></button>").join("") + "</div>" +
      '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Teléfono</th><th class="num">Pedidos</th><th>Alta</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
      list.map((u) => '<tr><td><div class="row" style="flex-wrap:nowrap;gap:10px"><span class="avatar">' + esc(fmt.initials(u.nombre)) + '</span><div style="min-width:0"><strong class="truncate" style="display:block;max-width:24ch">' + esc(u.nombre) + (u.id === user.id ? ' <span class="xs muted">(tú)</span>' : "") + '</strong><span class="xs muted truncate" style="display:block;max-width:28ch">' + esc(u.email) + "</span></div></div></td>" +
        "<td>" + (u.rol === "admin" ? RFH.badge("accent", "Administrador") : '<span class="badge">' + icon("user") + "Cliente</span>") + "</td>" +
        '<td class="small nowrap">' + esc(u.telefono || "—") + "</td>" +
        '<td class="num">' + db.pedidos.filter((o) => o.clienteId === u.id).length + "</td>" +
        '<td class="small nowrap">' + (u.creado ? fmt.date(u.creado) : "—") + "</td>" +
        "<td>" + (u.activo ? RFH.badge("ok", "Activo") : RFH.badge("crit", "Desactivado")) + "</td>" +
        '<td><div class="actions"><button class="btn btn-ghost btn-icon btn-sm" type="button" data-edit="' + u.id + '" aria-label="Editar ' + esc(u.nombre) + '">' + icon("pencil", "icon-sm") + "</button>" +
        (u.id !== user.id ? '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-toggle="' + u.id + '" aria-label="' + (u.activo ? "Desactivar" : "Activar") + " a " + esc(u.nombre) + '">' + icon("power", "icon-sm") + "</button>" : "") +
        "</div></td></tr>").join("") +
      "</tbody></table></div></div>";

    el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { usrRol = b.dataset.f; refresh(); }));
    el.querySelector("#btn-new").addEventListener("click", () => usuarioForm(null));
    el.querySelector("tbody").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit]"), tg = e.target.closest("[data-toggle]");
      if (ed) usuarioForm(db.usuario(ed.dataset.edit));
      if (tg) {
        const u = db.usuario(tg.dataset.toggle);
        const go = async () => { await db.usuarioActivo(u.id, !u.activo); RFH.toast(u.nombre + (u.activo ? " desactivado" : " activado")); refresh(); };
        if (u.activo) RFH.confirm("¿Desactivar a " + u.nombre + "?", "No podrá iniciar sesión hasta que lo vuelvas a activar. Sus pedidos se conservan.", "Desactivar", go);
        else go().catch((err) => RFH.toast(err.message, "error"));
      }
    });
  }

  function usuarioForm(u) {
    const isNew = !u;
    u = u || { nombre: "", email: "", telefono: "", rol: "cliente", activo: true };
    RFH.modal({
      title: isNew ? "Nuevo usuario" : "Editar usuario",
      okText: isNew ? "Crear usuario" : "Guardar cambios",
      body: '<div class="form-grid cols-2">' +
        RFH.field({ name: "nombre", label: "Nombre completo", value: u.nombre, span: true }) +
        RFH.field({ name: "email", label: "Correo", value: u.email, type: "email", attrs: 'inputmode="email"' + (isNew ? "" : " readonly") }) +
        RFH.field({ name: "telefono", label: "Teléfono", value: u.telefono, type: "tel", attrs: 'inputmode="tel"' }) +
        RFH.field({ name: "rol", label: "Rol", type: "select", value: u.rol, options: [{ value: "cliente", label: "Cliente" }, { value: "admin", label: "Administrador" }], hint: "Administrador ve y cambia todo el panel. Da este rol solo a quien lo necesite." }) +
        (isNew ? RFH.field({ name: "password", label: "Contraseña temporal", type: "password", attrs: 'autocomplete="new-password"', hint: "Mínimo 8 caracteres. Pídele que la cambie." }) : "") +
        "</div>",
      onOpen: (f) => { if (u.id === user.id) f.rol.disabled = true; },
      onSubmit: async (f) => {
        const rules = {
          nombre: (v) => v.length < 3 ? "Escribe el nombre." : "",
          email: (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Escribe un correo válido." : isNew && db.usuarios.some((x) => x.email.toLowerCase() === v.toLowerCase()) ? "Ese correo ya está registrado." : "",
          telefono: (v) => v && v.replace(/\D/g, "").length !== 10 ? "El teléfono debe tener 10 dígitos." : ""
        };
        if (isNew) rules.password = (v) => v.length < 8 ? "Mínimo 8 caracteres." : "";
        if (!RFH.validate(f, rules)) return false;
        const data = { nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), rol: f.rol.disabled ? u.rol : f.rol.value };
        if (isNew) Object.assign(data, { email: f.email.value.trim(), password: f.password.value });
        else data.id = u.id;
        await db.guardarUsuario(data);
        RFH.toast(isNew ? "Usuario creado" : "Cambios guardados");
        refresh();
      }
    });
  }

  /* =====================================================
     Arranque
     ===================================================== */
  const routes = {
    resumen: { title: "Resumen", icon: "dashboard", render: viewDashboard },
    ventas: { title: "Ventas", icon: "receipt", render: viewVentas },
    pedidos: { title: "Pedidos en línea", icon: "bag", render: viewPedidos },
    productos: { title: "Productos", icon: "package", render: viewProductos },
    inventario: { title: "Inventario", icon: "clipboard", render: viewInventario },
    proveedores: { title: "Proveedores", icon: "truck", render: viewProveedores },
    usuarios: { title: "Usuarios", icon: "users", render: viewUsuarios }
  };

  (function init() {
    document.getElementById("today").textContent = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    shell = RFH.shell({
      user: user,
      default: "resumen",
      routes: routes,
      nav: [
        { group: "Operación" }, { key: "resumen" }, { key: "ventas" }, { key: "pedidos", badge: () => pedidosActivos().length },
        { group: "Catálogo y almacén" }, { key: "productos" }, { key: "inventario", badge: () => alertasInv().length }, { key: "proveedores" },
        { group: "Administración" }, { key: "usuarios" }
      ]
    });
  })();
  } // main
})(window.RFH);
