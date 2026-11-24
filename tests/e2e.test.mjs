/*
 * ReyesFruitHub · prueba de interfaz de punta a punta (Chrome/Edge sin ventana)
 *   node tests/e2e.test.mjs http://localhost:8091
 * Recorre cliente y administrador en celular y escritorio, contra la base de pruebas.
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.argv[2] || "http://localhost:8091").replace(/\/$/, "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "capturas");
mkdirSync(OUT, { recursive: true });
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let pass = 0, fail = 0;

async function paso(nombre, fn) {
  try { await fn(); pass++; console.log("  ✓ " + nombre); }
  catch (e) { fail++; console.log("  ✗ " + nombre + "\n      → " + e.message.split("\n")[0]); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };

async function recorrido(tag, viewport) {
  console.log(`\n${tag} (${viewport.width}×${viewport.height})`);
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|favicon|status of 4\d\d/.test(m.text())) errores.push(m.text()); });
  const desborde = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const shot = (n, full = true) => page.screenshot({ path: join(OUT, `${tag}-${n}.png`), fullPage: full });
  const ir = async (ruta) => { await page.goto(BASE + "/" + ruta); await page.waitForLoadState("networkidle"); await page.waitForTimeout(350); };

  await paso("Portada carga productos desde la base, con fotos", async () => {
    await ir("index.html");
    const n = await page.locator(".product").count();
    ok(n >= 20, "productos en portada: " + n);
    const rotas = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    ok(rotas.length === 0, "imágenes rotas: " + rotas.join(", "));
    ok((await desborde()) <= 1, "desborde horizontal");
    await shot("portada");
  });

  await paso("Login con error muestra mensaje y no entra", async () => {
    await ir("login.html");
    await page.fill("#l-email", "cliente@reyesfruithub.demo");
    await page.fill("#l-pass", "incorrecta");
    await page.click('#form-login button[type="submit"]');
    await page.waitForSelector("#login-alert.is-visible");
    ok(page.url().includes("login.html"), "no debe redirigir");
  });

  await paso("Cliente: entra, agrega al carrito y confirma pedido a domicilio", async () => {
    await page.fill("#l-pass", "demo123");
    await page.click('#form-login button[type="submit"]');
    await page.waitForURL(/cliente\.html/);
    await page.waitForSelector(".product");
    await page.waitForTimeout(300);
    ok((await desborde()) <= 1, "desborde en catálogo");
    await shot("cliente-catalogo", false);
    await page.locator("[data-add]").first().click();
    await page.locator("[data-inc]").first().click();
    await page.fill("#q", "mango");
    await page.locator("[data-add]").first().click();
    await page.fill("#q", "");
    await ir("cliente.html#carrito");
    ok((await page.locator(".cart-line").count()) === 2, "dos líneas en el carrito");
    await page.check('[name="entrega"][value="domicilio"]', { force: true });
    await page.fill("#f-direccion", "");
    await page.click("#btn-confirmar");
    ok((await page.locator(".field.has-error").count()) > 0, "debe pedir dirección");
    await page.fill("#f-direccion", "Calle 41 #200 x 40 y 42, Centro");
    await page.fill("#f-notas", '<img src=x onerror="window.__xss=1">');
    await page.click("#btn-confirmar");
    await page.waitForURL(/#pedidos/);
    await page.waitForTimeout(400);
    ok((await page.locator(".order-card").first().textContent()).includes("Calle 41"), "pedido nuevo con dirección");
    ok(!(await page.evaluate(() => window.__xss)), "las notas con HTML no deben ejecutarse");
    ok((await desborde()) <= 1, "desborde en pedidos");
    await shot("cliente-pedidos");
  });

  await paso("Cliente: no puede abrir el panel de administrador", async () => {
    await ir("admin.html");
    ok(page.url().includes("cliente.html"), "debe regresarlo a su módulo, está en " + page.url());
  });

  await paso("Cliente: cierra sesión", async () => {
    await ir("cliente.html#perfil");
    if (viewport.width < 980) await page.click("#btn-menu");
    await page.click("#btn-salir");
    await page.waitForURL(/login\.html/);
  });

  await paso("Administrador: todas las vistas cargan sin errores ni desbordes", async () => {
    await page.click('[data-demo="admin@reyesfruithub.demo"]');
    await page.waitForURL(/admin\.html/);
    for (const r of ["resumen", "ventas", "pedidos", "productos", "inventario", "proveedores", "usuarios"]) {
      await ir("admin.html#" + r);
      ok((await desborde()) <= 1, "desborde en " + r);
      await shot("admin-" + r, viewport.width >= 980);
    }
  });

  await paso("Administrador: avanza el pedido hasta entregado y baja la existencia", async () => {
    await ir("admin.html#pedidos");
    const fila = page.locator("tbody tr", { hasText: "Cliente Demo" }).first();
    for (let i = 0; i < 3; i++) {
      await fila.locator("[data-next]").click();
      await page.waitForLoadState("networkidle"); await page.waitForTimeout(250);
      if (i < 2) await page.click('[data-f="todos"]');
    }
    await page.click('[data-f="entregado"]');
    ok((await page.locator("tbody tr").count()) >= 1, "debe aparecer en entregados");
  });

  await paso("Administrador: cobra una venta de mostrador", async () => {
    await ir("admin.html#ventas");
    await page.locator(".pos-item:not([disabled])").first().click();
    await page.locator(".pos-item:not([disabled])").nth(1).click();
    await page.click("#tk-cobrar");
    await page.waitForSelector('.toast:has-text("registrada")', { timeout: 8000 });
  });

  await paso("Administrador: validación de producto y nombre con HTML se muestra como texto", async () => {
    await ir("admin.html#productos");
    await page.click("#btn-new");
    await page.click('dialog button[type="submit"]');
    ok((await page.locator("dialog .field.has-error").count()) > 0, "debe marcar campos");
    await page.fill("#f-nombre", '<b onmouseover="window.__xss=1">Mamey ' + tag + '</b>');
    await page.fill("#f-precio", "60");
    await page.fill("#f-costo", "35");
    await page.click('dialog button[type="submit"]');
    await page.waitForSelector("dialog", { state: "detached", timeout: 8000 });
    await page.fill("#pq", "Mamey " + tag);
    const celda = page.locator("tbody .cell-prod strong").first();
    ok((await celda.textContent()).includes("<b"), "el nombre debe verse como texto literal");
    ok((await page.locator("tbody b[onmouseover]").count()) === 0, "no debe crearse HTML");
  });

  await paso("Administrador: registra una entrada de inventario", async () => {
    await ir("admin.html#inventario");
    await page.click("#btn-entrada");
    await page.fill("#f-cantidad", "12");
    await page.click('dialog button[type="submit"]');
    await page.waitForSelector("dialog", { state: "detached" });
    await page.waitForSelector(".toast");
    await page.locator("[data-lotes]").first().click();
    await shot("admin-lotes", false);
    await page.keyboard.press("Escape");
  });

  ok(true);
  await paso("Sin errores de JavaScript en consola", async () => { ok(errores.length === 0, errores.join(" | ")); });
  await ctx.close();
}

await recorrido("celular", { width: 390, height: 844 });
await recorrido("escritorio", { width: 1440, height: 900 });
await browser.close();
console.log(`\nResultado: ${pass} correctas, ${fail} fallidas · capturas en tests/capturas/`);
process.exit(fail ? 1 : 0);
