// Capture screenshots of Dashboard-react via puppeteer-core driving system Edge.
// Each shot waits for network idle (with a fallback timeout), then 250ms for
// any final paint, at 1440x900 to match the Statistics-Compendium captures.
import puppeteer from "puppeteer-core";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const BASE = "http://localhost:5173";
const OUT = String.raw`C:\Users\Admin\Documents\Claude\Github\Dashboard-react\screenshots`;

const SHOTS = [
  ["01-home", "/"],
  ["02-plan", "/plan"],
  ["03-todo", "/todo"],
  ["04-skole", "/skole"],
  ["05-notes", "/notes"],
  ["06-sport", "/sport"],
  ["07-gaming", "/gaming"],
  ["08-links", "/links"],
  ["09-tools", "/tools"],
  ["10-tools-calculator", "/tools/calculator"],
  ["11-tools-qr", "/tools/qr"],
  ["12-tools-timer", "/tools/timer"],
  ["13-tools-pdf", "/tools/pdf"],
  ["14-tools-reader", "/tools/reader"],
  ["15-tools-video", "/tools/video"],
  ["16-tools-bgremove", "/tools/bgremove"],
  ["17-tools-convert", "/tools/convert"],
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--hide-scrollbars", "--disable-gpu", "--no-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(15000);
  for (const [name, path] of SHOTS) {
    const url = `${BASE}${path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 12000 });
    } catch {
      // Fallback: at least DOM-loaded if network never idles
      try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 }); } catch {}
    }
    await new Promise((r) => setTimeout(r, 700));
    const out = `${OUT}\\${name}.png`;
    await page.screenshot({ path: out, fullPage: false });
    console.log(`captured ${name}.png`);
  }
} finally {
  await browser.close();
}
