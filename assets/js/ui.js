/* =========================================================
   ReyesFruitHub · utilidades de interfaz compartidas
   (íconos SVG, formatos es-MX, toasts, diálogos, ilustraciones)
   ========================================================= */
window.RFH = window.RFH || {};

(function (RFH) {
  "use strict";

  /* ---------- Íconos (trazos estilo Lucide, licencia ISC) ---------- */
  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>'
  };
  RFH.icon = function (name, cls) {
    return '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || "") + "</svg>";
  };

  /* ---------- Formatos es-MX ---------- */
  const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
  const dShort = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
  const dLong = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
  const dTime = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const dWeek = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
  const plural = new Intl.PluralRules("es-MX");

  RFH.fmt = {
    money: (v) => money.format(v || 0),
    num: (v) => num.format(v || 0),
    date: (iso) => dLong.format(new Date(iso)),
    dateShort: (iso) => dShort.format(new Date(iso)),
    dateTime: (iso) => dTime.format(new Date(iso)),
    weekday: (iso) => dWeek.format(new Date(iso)),
    qty: (v, unidad) => num.format(v) + " " + RFH.fmt.unit(unidad, v),
    unit: (u, v) => {
      const one = plural.select(v) === "one";
      if (u === "kg") return "kg";
      if (u === "manojo") return one ? "manojo" : "manojos";
      return one ? "pieza" : "piezas";
    },
    plural: (n, one, many) => n + " " + (plural.select(n) === "one" ? one : many),
    /* «hace 2 días» solo hasta una semana; después, fecha absoluta */
    relative: (iso) => {
      const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 1) return "justo ahora";
      if (diff < 60) return "hace " + diff + " min";
      const h = Math.round(diff / 60);
      if (h < 24) return "hace " + RFH.fmt.plural(h, "hora", "horas");
      const d = Math.round(h / 24);
      if (d < 7) return "hace " + RFH.fmt.plural(d, "día", "días");
      return dLong.format(new Date(iso));
    },
    initials: (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  };

  /* Escapar texto antes de insertarlo en HTML */
  RFH.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  /* ---------- Ilustración de producto (marcador hasta tener fotos reales) ---------- */
  RFH.fruitArt = function (p) {
    const c = p.color || "#f59e0b";
    const tone = /^[a-z]+$/.test(p.fondo || "") ? p.fondo : "orange";
    let body;
    switch (p.forma) {
      case "hoja":
        body = '<path d="M50 88C26 80 18 56 26 36c8-18 30-22 46-10 14 11 16 34 4 50-6 8-15 12-26 12Z" fill="' + c + '"/><path d="M50 86C46 64 46 44 54 26" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 62 36 52M51 48l14-10M49 74l-10-6" stroke="rgba(255,255,255,.45)" stroke-width="2.5" stroke-linecap="round"/>';
        break;
      case "racimo":
        body = '<g fill="' + c + '"><circle cx="38" cy="40" r="11"/><circle cx="60" cy="40" r="11"/><circle cx="49" cy="56" r="11"/><circle cx="30" cy="58" r="10"/><circle cx="68" cy="58" r="10"/><circle cx="40" cy="73" r="10"/><circle cx="58" cy="73" r="10"/><circle cx="49" cy="88" r="9"/></g><path d="M49 30c0-8 3-14 9-18" stroke="#5b4636" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M53 22c8-6 18-4 22 2-8 5-16 4-22-2Z" fill="#16a34a"/>';
        break;
      case "largo":
        body = '<path d="M22 36c10 34 40 52 66 42 4-2 4-7 0-8-24 6-46-8-56-38-2-5-11-2-10 4Z" fill="' + c + '"/><path d="M84 72l8-2" stroke="#5b4636" stroke-width="4" stroke-linecap="round"/><path d="M30 40c10 24 30 38 52 36" stroke="rgba(255,255,255,.45)" stroke-width="3" fill="none" stroke-linecap="round"/>';
        break;
      case "ovalo":
        body = '<ellipse cx="50" cy="58" rx="28" ry="34" fill="' + c + '"/><ellipse cx="40" cy="44" rx="7" ry="11" fill="rgba(255,255,255,.35)"/><path d="M50 24c0-6 2-10 6-13" stroke="#5b4636" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M54 18c8-6 18-4 22 2-8 5-16 4-22-2Z" fill="#16a34a"/>';
        break;
      case "punta":
        body = '<path d="M36 30c-10 12-10 32 0 46 6 8 10 16 12 22 6-8 18-20 20-38 2-16-6-30-18-32-6-1-10 0-14 2Z" fill="' + c + '"/><path d="M40 28c2-8 8-12 16-12" stroke="#15803d" stroke-width="5" fill="none" stroke-linecap="round"/>';
        break;
      default: // redondo
        body = '<circle cx="50" cy="58" r="32" fill="' + c + '"/><ellipse cx="38" cy="46" rx="8" ry="11" fill="rgba(255,255,255,.35)"/><path d="M50 26c0-6 2-10 6-13" stroke="#5b4636" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M54 20c8-6 18-4 22 2-8 5-16 4-22-2Z" fill="#16a34a"/>';
    }
    // Con foto: la imagen va encima de la ilustración; si no carga, se quita y queda la ilustración
    const foto = p.imagen && /^(assets\/img\/|https:\/\/)/.test(p.imagen)
      ? '<img src="' + RFH.esc(p.imagen) + '" alt="" loading="lazy" decoding="async" width="720" height="540" onerror="this.remove()">'
      : "";
    return '<div class="thumb tone-' + tone + (foto ? " has-photo" : "") + '"><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + body + "</svg>" + foto + "</div>";
  };

  /* ---------- Toasts (región aria-live) ---------- */
  RFH.toast = function (msg, type) {
    let region = document.querySelector(".toasts");
    if (!region) {
      region = document.createElement("div");
      region.className = "toasts";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " is-error" : "");
    el.innerHTML = RFH.icon(type === "error" ? "xCircle" : "checkCircle") + "<span>" + RFH.esc(msg) + "</span>";
    region.appendChild(el);
    setTimeout(() => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 260); }, 3200);
  };

  /* ---------- Diálogo modal (usa <dialog> nativo: foco y Esc incluidos) ---------- */
  RFH.modal = function (opts) {
    const dlg = document.createElement("dialog");
    dlg.className = "modal";
    dlg.setAttribute("aria-labelledby", "dlg-title");
    dlg.innerHTML =
      '<form method="dialog" novalidate>' +
      '<div class="modal-head"><h2 id="dlg-title">' + RFH.esc(opts.title) + '</h2><span class="spacer"></span>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Cerrar">' + RFH.icon("x") + "</button></div>" +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      '<div class="modal-foot">' +
      '<button type="button" class="btn btn-ghost" data-close>' + RFH.esc(opts.cancelText || "Cancelar") + "</button>" +
      '<button type="submit" class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" value="ok">' + RFH.esc(opts.okText || "Guardar") + "</button>" +
      "</div></form>";
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form");
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => dlg.remove());
    let busy = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const btn = form.querySelector('button[type="submit"]');
      const label = btn.textContent;
      busy = true;
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        const ok = opts.onSubmit ? await opts.onSubmit(form, dlg) : true;
        if (ok !== false) dlg.close();
      } catch (err) {
        RFH.toast(err.message, "error");
      } finally {
        busy = false;
        if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
      }
    });
    if (opts.onOpen) opts.onOpen(form, dlg);
    dlg.showModal();
    const first = dlg.querySelector(".modal-body input, .modal-body select, .modal-body textarea");
    if (first) first.focus();
    return dlg;
  };

  RFH.confirm = function (title, text, okText, onOk) {
    return RFH.modal({ title: title, body: "<p>" + RFH.esc(text) + "</p>", okText: okText || "Confirmar", danger: true, onSubmit: () => onOk() });
  };

  /* Validación de formularios: marca el campo y muestra el error junto a él */
  RFH.validate = function (form, rules) {
    let ok = true;
    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      const field = input.closest(".field");
      const msg = rules[name](input.value.trim(), input);
      if (field) {
        field.classList.toggle("has-error", !!msg);
        const err = field.querySelector(".error");
        if (err) err.textContent = msg || "";
      }
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg && ok) { input.focus(); ok = false; }
    });
    return ok;
  };

  RFH.field = function (o) {
    const id = "f-" + o.name;
    let control;
    if (o.type === "select") {
      control = '<select class="select" id="' + id + '" name="' + o.name + '">' +
        o.options.map((op) => '<option value="' + RFH.esc(op.value) + '"' + (String(op.value) === String(o.value) ? " selected" : "") + ">" + RFH.esc(op.label) + "</option>").join("") + "</select>";
    } else if (o.type === "textarea") {
      control = '<textarea class="input" id="' + id + '" name="' + o.name + '" rows="3">' + RFH.esc(o.value || "") + "</textarea>";
    } else {
      control = '<input class="input" id="' + id + '" name="' + o.name + '" type="' + (o.type || "text") + '"' +
        (o.value != null ? ' value="' + RFH.esc(o.value) + '"' : "") +
        (o.attrs ? " " + o.attrs : "") + (o.hint ? ' aria-describedby="' + id + '-h"' : "") + ">";
    }
    return '<div class="field' + (o.span ? " span-2" : "") + '"><label for="' + id + '">' + RFH.esc(o.label) + "</label>" + control +
      (o.hint ? '<span class="hint" id="' + id + '-h">' + RFH.esc(o.hint) + "</span>" : "") + '<span class="error" role="alert"></span></div>';
  };

  /* Insignia de estado: siempre ícono + texto, nunca solo color */
  RFH.badge = function (kind, text) {
    const ico = { ok: "checkCircle", warn: "alert", crit: "xCircle", info: "clock", accent: "clock" }[kind] || "clock";
    return '<span class="badge badge-' + kind + '">' + RFH.icon(ico) + RFH.esc(text) + "</span>";
  };
})(window.RFH);
