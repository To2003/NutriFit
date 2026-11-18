const { chromium } = require("playwright");
const path = require("path");
const OUT = path.resolve(process.env.OUT || ".video");
const B = process.env.BASE_URL || "http://localhost:3000";
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=2"] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(css);
    });
    document.addEventListener("pointerdown", (e) => {
      const d = document.createElement("div");
      const z = parseFloat(getComputedStyle(document.documentElement).zoom || "1") || 1;
      d.style.cssText = `position:fixed;left:${e.clientX / z - 24}px;top:${e.clientY / z - 24}px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.85);pointer-events:none;z-index:2147483647;transition:transform .5s ease-out,opacity .5s ease-out;`;
      document.documentElement.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = "scale(1.9)"; d.style.opacity = "0"; });
      setTimeout(() => d.remove(), 600);
    }, true);
  });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console:", m.text().slice(0, 300)); });
  fs.rmSync(OUT + "/sc", { recursive: true, force: true });
  fs.mkdirSync(OUT + "/sc", { recursive: true });
  const frames = [];
  const cdp = await ctx.newCDPSession(p);
  cdp.on("Page.screencastFrame", async (f) => {
    const name = String(frames.length).padStart(5, "0") + ".jpg";
    fs.writeFileSync(OUT + "/sc/" + name, Buffer.from(f.data, "base64"));
    frames.push({ name, ts: f.metadata.timestamp * 1000 });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const t0 = Date.now();
  const ev = [];
  const caps = [];
  const now = () => (Date.now() - t0) / 1000;
  const wait = (ms) => p.waitForTimeout(ms);
  const tap = async (loc) => {
    console.log("step", now().toFixed(1), String(loc).slice(0, 90));
    const el = loc.first();
    try { await el.waitFor({ state: "visible", timeout: 10000 }); } catch (e) { await p.screenshot({ path: OUT + "/fail.png" }); throw e; }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await wait(220);
    ev.push({ t: now(), k: "tap" });
    await el.click();
  };
  const ok = () => ev.push({ t: now(), k: "ok" });
  const cap = (text, sub) => { if (caps.length) caps[caps.length - 1].end = now(); caps.push({ start: now(), end: null, text, sub }); };
  const typeSlow = async (loc, text) => { await tap(loc); for (const ch of text) { await p.keyboard.type(ch); if (ch !== " ") ev.push({ t: now(), k: "key" }); await wait(55); } };
  const scroll = async (dy, steps = 12) => { for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, dy / steps); await wait(28); } };

  // 1) Intro
  await p.goto(B + "/login", { waitUntil: "networkidle" });
  cap("NutriFit", "Cómo cargar todo en 3 toques");
  await wait(3200);
  await tap(p.getByRole("button", { name: /Entrar/ }));
  await p.waitForURL("**/inicio"); await wait(900);

  // 2) Home
  cap("Tu día de un vistazo", "Lo que comiste vs. tu objetivo de hoy");
  await wait(2600);
  cap("Agua", "Un toque: +250 ml");
  await tap(p.getByRole("button", { name: "Sumar 250 ml de agua" })); ok(); await wait(1500);
  await tap(p.getByRole("button", { name: "Sumar 250 ml de agua" })); ok(); await wait(1800);

  // 3) Comida por texto
  cap("Comida", "Tocá + y contale qué comiste");
  await tap(p.getByRole("button", { name: "Cargar algo" })); await wait(1100);
  await tap(p.getByText("Comida", { exact: true })); await wait(900);
  await typeSlow(p.getByLabel("Qué comiste"), "2 empanadas de carne y una coca");
  await wait(500);
  cap("El Profe lo arma solo", "Revisás las porciones y listo");
  await tap(p.getByRole("button", { name: "Analizar" })); await wait(2200);
  await tap(p.getByRole("button", { name: "Guardar comida" })); ok(); await wait(2600);

  // 4) ¿Qué como?
  cap("¿Qué como?", "3 ideas con lo que tenés en casa");
  await tap(p.getByRole("link", { name: "Diario" })); await p.waitForURL("**/diario"); await wait(1200);
  await tap(p.getByText("¿Qué como?")); await wait(900);
  await typeSlow(p.getByLabel("Qué tenés en casa"), "huevos, arroz y atún");
  await tap(p.getByRole("button", { name: "Dame ideas" })); await wait(2000);
  await scroll(320); await wait(1800);
  await tap(p.getByRole("button", { name: "Cerrar" })); await wait(800);

  // 5) Entreno
  cap("Tu rutina", "Armada según tu deporte y tus partidos");
  await tap(p.getByRole("link", { name: "Entreno" })); await p.waitForURL("**/entreno"); await wait(1500);
  await scroll(260); await wait(1300);
  cap("En el gym", "Marcás cada serie y arranca el descanso");
  const start = p.locator('a[href^="/entreno/sesion/"]').first();
  await tap(start); await p.waitForURL("**/entreno/sesion/**"); await wait(1500);
  await tap(p.locator("section button[aria-expanded]").nth(1)); await wait(900);
  await tap(p.getByLabel("Sumar kg").first()); await wait(400);
  await tap(p.getByLabel("Marcar serie 1 hecha").first()); ok(); await wait(2200);
  await tap(p.getByLabel("Marcar serie 2 hecha").first()); ok(); await wait(1800);
  cap("Terminá y mirá cómo te fue", "Volumen, récords y el feedback del Profe");
  await tap(p.getByRole("button", { name: "Terminar" })); await wait(900);
  await tap(p.getByRole("button", { name: "8", exact: true })); await wait(400);
  await tap(p.getByRole("button", { name: "Terminar sesión" })); ok(); await wait(3600);

  // 6) Social
  cap("Con tu equipo", "Seguí a tus amigos y copiá rutinas");
  await p.goto(B + "/perfil/juanpi", { waitUntil: "networkidle" }); await wait(1600);
  await scroll(380); await wait(1800);

  // Outro
  cap("NutriFit", "Comé, entrená, rendí.");
  await p.goto(B + "/login", { waitUntil: "networkidle" }); await wait(3200);
  caps[caps.length - 1].end = now();
  const total = now();
  await cdp.send("Page.stopScreencast");
  await ctx.close();
  // concat demuxer: cada cuadro dura hasta el siguiente
  const rel = frames.map((f) => ({ ...f, t: (f.ts - t0) / 1000 })).filter((f) => f.t >= -0.5);
  let list = "";
  rel.forEach((f, i) => {
    const next = i + 1 < rel.length ? rel[i + 1].t : total;
    list += `file '${OUT}/sc/${f.name}'\nduration ${Math.max(0.001, next - Math.max(0, f.t)).toFixed(4)}\n`;
  });
  list += `file '${OUT}/sc/${rel[rel.length - 1].name}'\n`;
  fs.writeFileSync(OUT + "/frames.txt", list);
  fs.writeFileSync(OUT + "/timeline.json", JSON.stringify({ total, ev, caps, firstFrame: rel[0].t }, null, 1));
  console.log("ok", total.toFixed(1), "s", rel.length, "cuadros", ev.length, "eventos");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
