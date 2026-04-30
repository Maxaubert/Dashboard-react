// Capture two gaming-tab views:
//   07-gaming.png            — wishlist loaded, after a 30s settle
//   07b-gaming-detail.png    — first game's price-history modal
import puppeteer from "puppeteer-core";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const URL = "http://localhost:5173/gaming";
const OUT = String.raw`C:\Users\Admin\Documents\Claude\Github\Dashboard-react\screenshots`;

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--hide-scrollbars", "--disable-gpu", "--no-sandbox"],
});

try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(20000);

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // Wait for at least one game card to render, then settle 30s for wishlist + images.
  await page.waitForSelector(".game-card", { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 30000));

  await page.screenshot({ path: `${OUT}\\07-gaming.png`, fullPage: false });
  console.log("captured 07-gaming.png");

  // Click the first game card to open the price-history modal.
  await page.evaluate(() => {
    const card = document.querySelector(".game-card");
    if (card) card.click();
  });

  // Wait for modal to appear and for the chart to load (or empty state).
  await page.waitForSelector(".gaming-modal-panel", { timeout: 8000 });
  await page.waitForFunction(
    () => {
      const chart = document.querySelector(".gaming-modal-chart svg");
      const empty = document.querySelector(".gaming-modal-chart-empty");
      return Boolean(chart || empty);
    },
    { timeout: 30000 },
  );
  // Small extra settle for the SVG to fully paint.
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: `${OUT}\\07b-gaming-detail.png`, fullPage: false });
  console.log("captured 07b-gaming-detail.png");
} finally {
  await browser.close();
}
