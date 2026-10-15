const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const base = process.env.SKILLSCOPE_URL || "http://127.0.0.1:8001";
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 }, reducedMotion: "reduce", colorScheme: "light" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/#overview`);
    await page.locator('.snapshot-content[aria-busy="false"]').waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "Default ignores the OS light preference");
    const overview = await (await page.request.get(`${base}/api/overview`)).json();
    const configured = ["kg", "kz", "uz", "ge", "ru", "tj", "tm"];
    const ordered = [...configured].sort((a, b) => (overview.salary_coverage_by_market[b]?.included_vacancies || 0) - (overview.salary_coverage_by_market[a]?.included_vacancies || 0));
    const optionValues = (name) => page.getByRole("combobox", { name, exact: true }).locator("option").evaluateAll((options) => options.map((option) => option.value));
    assert.deepEqual(await optionValues("Market"), ["all", ...ordered]);
    assert.deepEqual(await page.locator(".country-mix button").evaluateAll((buttons) => buttons.map((button) => button.querySelector(".country-identity > span").textContent.toLowerCase())), ordered);
    const expectedNames = await page.getByRole("combobox", { name: "Market", exact: true }).locator("option").allTextContents();
    assert.deepEqual(await page.locator(".market-skill-country-name strong").allTextContents(), expectedNames.slice(1));
    await page.getByRole("combobox", { name: "Field", exact: true }).selectOption("qa");
    await page.locator('.snapshot-content[aria-busy="false"]').waitFor();
    assert.deepEqual(await optionValues("Market"), ["all", ...ordered], "Filters must not reshuffle country menus");
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await page.locator('.snapshot-content[aria-busy="false"]').waitFor();
    await page.getByRole("tab", { name: "My route", exact: true }).click();
    await page.locator(".route-advanced > summary").click();
    assert.deepEqual(await optionValues("Route market"), ["all", ...ordered]);
    await page.getByRole("button", { name: "Explore Data analysis", exact: true }).click();
    await page.getByText("What do current vacancies say?", { exact: true }).click();
    assert.deepEqual(await optionValues("Career market"), ["all", ...ordered]);
    await page.getByRole("tab", { name: "Salaries", exact: true }).click();
    await page.getByRole("combobox", { name: "Experience requirements", exact: true }).selectOption("all");
    const groups = await (await page.request.get(`${base}/api/salaries`)).json();
    const reported = groups.filter((row) => row.vacancies_with_reported_salary > 0);
    assert.equal(await page.locator(".salary-summary-table").count(), 1, "Salaries stay in one familiar table");
    assert.equal(await page.locator(".salary-summary-table tbody tr").count(), reported.length);
    assert.deepEqual(await page.locator(".salary-summary-table thead th").allTextContents(), ["Market", "Role", "Published salary amounts"]);
    assert.deepEqual(await page.locator(".salary-summary-table tbody tr").evaluateAll((elements) => [...new Set(elements.map((element) => element.dataset.market))]), ordered.filter((code) => reported.some((row) => row.market === code)));
    await page.getByText("These summaries include different experience levels. They are not junior salary expectations.").waitFor();
    assert.equal(await page.locator(".salary-figure details").count(), 0, "Salary values must not require expanding rows");
    assert.equal(await page.getByText("Supporting ads", { exact: true }).count(), 0);
    const getRow = (row) => page.locator(`.salary-summary-table tr[data-market="${row.market}"][data-role="${row.role_family}"][data-currency="${row.currency}"]`);
    const number = (value) => new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value).replaceAll(",", "\u202f");
    const basedOn = (count) => count === 1 ? "Based on 1 vacancy" : `Based on ${count} vacancies`;
    for (const row of reported) {
      const element = getRow(row);
      const formats = [];
      if (row.median_midpoint_local !== null) formats.push(["range", `${number(row.median_range_from_local)}–${number(row.median_range_to_local)}`, row.complete_salary_ranges]);
      if (typeof row.median_from_only_local === "number") formats.push(["from", `from ${number(row.median_from_only_local)}`, row.from_only_count]);
      if (typeof row.median_to_only_local === "number") formats.push(["to", `up to ${number(row.median_to_only_local)}`, row.to_only_count]);
      for (const [kind, value, count] of formats) {
        const figure = element.locator(`.salary-figure[data-kind="${kind}"]`);
        assert.equal(await figure.isVisible(), true);
        assert.equal(await figure.locator(".salary-amount").innerText(), value);
        assert.equal(await figure.locator(".salary-sample").innerText(), basedOn(count), "Sample size belongs under its own figure");
      }
    }
    const reference = ordered.flatMap((market) => reported.filter((row) => row.market === market)).find((row) => row.median_midpoint_local !== null && typeof row.median_from_only_local === "number");
    const referenceRow = getRow(reference);
    const rates = await (await page.request.get(`${base}/api/exchange-rates`)).json();
    if (await page.getByRole("button", { name: "USD", exact: true }).isEnabled()) {
      await page.getByRole("button", { name: "USD", exact: true }).click();
      const code = reference.currency === "RUR" ? "RUB" : reference.currency;
      const rate = rates.rates_per_usd[code];
      assert.equal(await referenceRow.locator('[data-kind="range"] .salary-amount').innerText(), `${number(reference.median_range_from_local / rate)}–${number(reference.median_range_to_local / rate)}`);
      assert.equal(await referenceRow.locator('[data-kind="range"] .salary-unit').innerText(), "USD");
      assert.equal(await referenceRow.locator(".salary-source").innerText(), `Reported in ${code}`);
      assert.equal(await page.locator(".salary-summary-table tbody tr").count(), reported.length, "USD display never pools source-currency groups");
      await page.getByRole("button", { name: "Local currency", exact: true }).click();
    }
    const capture = async (filename) => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await page.locator(".salary-summary-table td").evaluateAll((cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).length), 0);
      await page.screenshot({ path: path.resolve(__dirname, `../../artifacts/${filename}`) });
    };
    const positionRows = async () => referenceRow.evaluate((element) => {
      const sticky = document.querySelector(innerWidth > 767 ? ".workspace-controls" : ".dashboard-tabs").getBoundingClientRect().height;
      window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - sticky - 16, behavior: "instant" });
    });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await capture("salary-simple-desktop.png");
    await positionRows();
    await capture("salary-simple-rows-desktop.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await positionRows();
    await capture("salary-simple-mobile.png");
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole("button", { name: "Switch to Kyrgyz" }).click();
    await positionRows();
    await capture("salary-simple-ky-dark.png");
    await page.getByRole("button", { name: "Англисчеге өтүү" }).click();
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await page.reload();
    await page.locator('.snapshot-content[aria-busy="false"]').waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light", "Explicit light preference survives reload");
    await page.setViewportSize({ width: 1366, height: 1000 });
    await positionRows();
    await capture("salary-simple-light-desktop.png");

    // The assistant checks keyboard submission against a local fixture, never the AI provider.
    const sent = [];
    await page.route("**/api/ask/status", (route) => route.fulfill({ json: { available: true } }));
    await page.route("**/api/ask", async (route) => {
      sent.push(route.request().postDataJSON().question);
      await route.fulfill({ json: { answer: "Keyboard submission works.", source: "project", sample_size: 0, snapshot_date: null } });
    });
    await page.getByRole("button", { name: "Open Mr. Scope assistant", exact: true }).click();
    const question = page.getByRole("textbox", { name: "Your question", exact: true });
    await page.getByText("SkillScope facts and reviewed HeadHunter vacancies", { exact: true }).waitFor();
    await question.fill("hi");
    await question.press("Enter");
    assert.equal(sent.length, 0, "Too-short questions do not submit");
    assert.equal(await question.inputValue(), "hi", "Enter does not insert a line break");
    await question.fill("First line");
    await question.press("Shift+Enter");
    await question.pressSequentially("Second line");
    assert.equal(await question.inputValue(), "First line\nSecond line");
    await question.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
    await question.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229 });
    await question.dispatchEvent("keydown", { key: "Enter", code: "Enter", repeat: true });
    assert.equal(sent.length, 0, "IME composition and held Enter must not submit");
    await question.press("Enter");
    await page.getByText("Keyboard submission works.", { exact: true }).waitFor();
    assert.deepEqual(sent, ["First line\nSecond line"], "Enter sends exactly one question, preserving explicit line breaks");
    assert.deepEqual(errors, []);
    console.log("PASS: stable country ordering; single salary table with all figures and their source counts visible; USD conversion; default dark and saved light preference; mobile/Kyrgyz; Enter/Shift+Enter and IME-safe Mr. Scope submission.");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
