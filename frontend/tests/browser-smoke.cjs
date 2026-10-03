// Start SkillScope first. Optional SKILLSCOPE_URL defaults to the local app.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const base = process.env.SKILLSCOPE_URL || "http://127.0.0.1:8000";
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, timeout: 20000 });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ready = () => page.locator(".kpi-grid").waitFor();
    const expectedCount = async (market, role = "all") => {
      const query = new URLSearchParams({ market });
      if (role !== "all") query.set("role", role);
      return (await (await page.request.get(`${base}/api/skills?${query}`)).json()).vacancy_denominator;
    };
    const assertCount = async (expected) => {
      await ready();
      assert.equal((await page.locator(".kpi-primary .kpi-value").innerText()).trim(), `${expected} vacancies`);
    };

    await page.goto(base);
    await ready();
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kg");
    await assertCount(await expectedCount("kg"));

    // A pending selection must not display the preceding selection's numbers.
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/skills?**", async (route) => { await gate; await route.continue(); });
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("kz");
    await page.getByRole("status").waitFor();
    assert.equal(await page.locator(".kpi-grid").count(), 0);
    release();
    await assertCount(await expectedCount("kz"));
    await page.unroute("**/api/skills?**");

    // Failure after a successful view must hide stale results and support retry.
    await page.route("**/api/skills?**", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("uz");
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".kpi-grid").count(), 0);
    await page.unroute("**/api/skills?**");
    await page.getByRole("button", { name: "Try again" }).click();
    await assertCount(await expectedCount("uz"));

    await page.route("**/api/skills?**", (route) => route.fulfill({ json: { vacancy_denominator: 0, items: [] } }));
    await page.route("**/api/salaries?**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/seniority?**", (route) => route.fulfill({ json: { vacancy_denominator: 0, items: [] } }));
    await page.getByRole("combobox", { name: "Role family" }).selectOption("bi_analyst");
    await assertCount(0);
    assert.equal(await page.getByText("No skill signals for these filters yet.").count(), 1);
    assert.equal(await page.getByText("No salary records for these filters.").count(), 1);
    await page.unrouteAll({ behavior: "wait" });

    await page.getByRole("combobox", { name: "Role family" }).selectOption("all");
    await ready();
    await page.getByRole("combobox", { name: "Market", exact: true }).selectOption("all");
    await ready();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const screenshots = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(screenshots, { recursive: true });
    for (const width of [1366, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const container = document.querySelector(".recharts-responsive-container");
        const chart = container?.querySelector(".recharts-wrapper");
        return !chart || Math.abs(chart.getBoundingClientRect().width - container.getBoundingClientRect().width) < 2;
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      if (dimensions.content > dimensions.viewport) {
        console.error(await page.evaluate(() => [...document.querySelectorAll("body *")]
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth)
          .map((element) => ({ element: `${element.tagName}.${element.className}`, right: element.getBoundingClientRect().right }))));
      }
      assert.ok(dimensions.content <= dimensions.viewport, `Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
      if (width === 1366 || width === 390) {
        await page.screenshot({ path: path.join(screenshots, `dashboard-${width}.png`), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS: filters, loading, error/retry, empty view, 1366/1024/390/320px layouts; no browser exceptions.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
