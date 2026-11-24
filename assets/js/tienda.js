/* ReyesFruitHub · página pública (index.html) */
(function (RFH) {
  "use strict";
  const db = RFH.db;
  let filtro = "todos";

  const activos = () => db.productos.filter((p) => p.activo);
  const contar = (cat) => activos().filter((p) => cat === "todos" || p.categoria === cat).length;

  function renderTiles() {
    document.getElementById("cat-tiles").innerHTML = RFH.categoryTiles(filtro, contar);
  }

  function renderGrid() {
    const list = activos()
      .filter((p) => filtro === "todos" || p.categoria === filtro)
      .sort((a, b) => (db.disponible(b.id) > 0) - (db.disponible(a.id) > 0) || b.destacado - a.destacado || a.nombre.localeCompare(b.nombre, "es"));
    document.getElementById("cat-title").textContent = filtro === "todos" ? "Lo que hay hoy en la frutería" : db.categoria(filtro);
    document.getElementById("product-grid").innerHTML = list.length
      ? list.map((p) => RFH.productCard(p)).join("")
      : '<div class="empty" style="grid-column:1/-1">' + RFH.icon("leaf") + "<strong>Sin productos en esta categoría</strong><span>Prueba con otra o vuelve más tarde.</span></div>";
  }

  RFH.arrancar(function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    const disponibles = activos().filter((p) => db.disponible(p.id) > 0);
    document.getElementById("hero-count").textContent = disponibles.length;
    document.getElementById("hero-mini").innerHTML = disponibles.filter((p) => p.destacado).slice(0, 3).map((p) =>
      "<li>" + RFH.fruitArt(p) + '<div style="min-width:0"><strong>' + RFH.esc(p.nombre) + '</strong><span class="xs muted">' + RFH.esc(db.categoria(p.categoria)) + "</span></div>" +
      '<span class="price">' + RFH.fmt.money(p.precio) + "<small> /" + RFH.fmt.unit(p.unidad, 1) + "</small></span></li>").join("");

    const u = db.sesion();
    if (u) {
      const dest = u.rol === "admin" ? "admin.html" : "cliente.html";
      const s = document.getElementById("btn-sesion");
      s.textContent = u.rol === "admin" ? "Panel" : "Mi cuenta";
      s.href = dest;
      document.getElementById("btn-cta-top").href = dest;
      document.querySelectorAll('a[href="login.html?modo=registro"]').forEach((a) => { a.href = dest; });
    }

    renderTiles();
    renderGrid();
    document.getElementById("cat-tiles").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      filtro = b.dataset.cat;
      renderTiles();
      renderGrid();
      document.getElementById("catalogo").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  });
})(window.RFH);
