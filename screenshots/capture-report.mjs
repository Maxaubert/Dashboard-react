// Smoke test for the report feature.
// 1. Open dashboard at /todo
// 2. Click the report button in the sidebar
// 3. Fill out the form (feature, then bug)
// 4. Submit and verify success toast + the file written
import puppeteer from "puppeteer-core";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const URL = process.env.DASHBOARD_URL || "http://localhost:5173/todo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
const OUT = __dirname;

async function rmReports() {
  await fs.rm(path.join(REPORTS_DIR, "bugs.md"), { force: true });
  await fs.rm(path.join(REPORTS_DIR, "features.md"), { force: true });
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  defaultViewport: { width: 1280, height: 800 },
  args: ["--hide-scrollbars", "--disable-gpu", "--no-sandbox"],
});

let exitCode = 0;
try {
  await rmReports();

  const page = await browser.newPage();
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      console.log(`[browser ${t}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

  page.setDefaultNavigationTimeout(20000);
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // Wait for the sidebar report button to render.
  await page.waitForSelector('button[aria-label="Report a bug or idea"]', {
    timeout: 10000,
  });

  // Open the modal.
  await page.click('button[aria-label="Report a bug or idea"]');
  await page.waitForSelector('form#report-form', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 600)); // let fonts settle
  await page.screenshot({ path: path.join(OUT, "report-01-open.png") });
  console.log("modal opened");

  // The default type is bug — switch to feature first.
  await page.evaluate(() => {
    const radios = document.querySelectorAll('[role="radio"]');
    for (const r of radios) {
      if (r.textContent && /feature/i.test(r.textContent)) {
        r.click();
        return;
      }
    }
  });

  // Fill and submit the feature form.
  await page.type('form#report-form input[id^="input-"]', "Puppeteer-test feature");
  await page.type('form#report-form textarea', "Detailed description of the proposed feature.");
  await page.evaluate(() => {
    const submit = document.querySelector('button[form="report-form"]');
    if (submit) submit.click();
  });

  // Wait for the success toast.
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('p')).some((el) => el.textContent === "Idea logged"),
    { timeout: 5000 },
  );
  console.log("feature toast shown");
  await page.screenshot({ path: path.join(OUT, "report-02-feature-saved.png") });

  // Wait for modal to fully close (form unmounted + radix removes aria-hidden).
  await page.waitForFunction(() => !document.querySelector('form#report-form'), { timeout: 3000 });
  await new Promise((r) => setTimeout(r, 400));

  // Now do a bug report.
  await page.waitForSelector('button[aria-label="Report a bug or idea"]', {
    timeout: 5000,
    visible: true,
  });
  await page.click('button[aria-label="Report a bug or idea"]');
  await page.waitForSelector('form#report-form', { timeout: 5000 });

  await page.type('form#report-form input[id^="input-"]', "Puppeteer-test bug");
  await page.type('form#report-form textarea', "Step 1, step 2, expected vs actual.");
  await page.evaluate(() => {
    const submit = document.querySelector('button[form="report-form"]');
    if (submit) submit.click();
  });

  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('p')).some((el) => el.textContent === "Bug logged"),
    { timeout: 5000 },
  );
  console.log("bug toast shown");

  // Verify files on disk.
  const features = await readIfExists(path.join(REPORTS_DIR, "features.md"));
  const bugs = await readIfExists(path.join(REPORTS_DIR, "bugs.md"));

  if (!features || !features.includes("Puppeteer-test feature")) {
    console.log("FAIL: features.md missing or wrong content");
    console.log(features);
    exitCode = 1;
  } else {
    console.log("OK features.md contains entry");
  }

  if (!bugs || !bugs.includes("Puppeteer-test bug")) {
    console.log("FAIL: bugs.md missing or wrong content");
    console.log(bugs);
    exitCode = 1;
  } else {
    console.log("OK bugs.md contains entry");
  }

  if (features && bugs && features.includes("/todo") && bugs.includes("/todo")) {
    console.log("OK page auto-fill captured /todo route");
  } else {
    console.log("FAIL: page auto-fill missing");
    console.log("--- features.md ---\n" + features);
    console.log("--- bugs.md ---\n" + bugs);
    exitCode = 1;
  }
} catch (err) {
  console.log("THREW:", err);
  exitCode = 1;
} finally {
  await browser.close();
  // Clean up the test artifacts we just created.
  await rmReports();
}

process.exit(exitCode);
