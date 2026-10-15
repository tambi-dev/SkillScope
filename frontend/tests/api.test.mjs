import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getOverview, getRoles, getSkills, getSalaries, getSalaryExamples, getSeniority, getTaxonomy } from "../src/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("all-market skills have a valid query and retain the zero denominator", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/skills?limit=8");
    return Response.json({ vacancy_denominator: 0, items: [] });
  };
  const result = await getSkills("all", "all", "all");
  assert.equal(result.vacancy_denominator, 0);
  assert.deepEqual(result.items, []);
});

test("country and role filters reach all filtered endpoints", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return Response.json([]); };
  await getSkills("kg", "bi_analyst", "data_ai");
  await getSalaries("kg", "bi_analyst", "data_ai");
  await getSeniority("kg", "bi_analyst", "data_ai");
  for (const url of urls) {
    const query = new URL(url, "http://test").searchParams;
    assert.equal(query.get("market"), "kg");
    assert.equal(query.get("role"), "bi_analyst");
    assert.equal(query.get("category"), "data_ai");
  }
});

test("taxonomy and role-demand endpoints are available to the dashboard", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return Response.json([]); };
  await getTaxonomy();
  await getRoles("uz", "software_engineering");
  assert.equal(urls[0], "/api/taxonomy");
  const query = new URL(urls[1], "http://test").searchParams;
  assert.equal(query.get("market"), "uz");
  assert.equal(query.get("category"), "software_engineering");
});

test("salary summaries and examples retain the same explicit experience and currency scope", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(new URL(url, "http://test")); return Response.json([]); };
  await getSalaries("ru", "data_analyst", "data_ai", undefined, "noExperience");
  await getSalaryExamples({ market: "ru", role_family: "data_analyst", currency: "RUB" }, "noExperience");
  for (const url of urls) {
    assert.equal(url.searchParams.get("experience"), "noExperience");
    assert.equal(url.searchParams.get("market"), "ru");
    assert.equal(url.searchParams.get("role"), "data_analyst");
  }
  assert.equal(urls[1].pathname, "/api/salary-examples");
  assert.equal(urls[1].searchParams.get("currency"), "RUB");
});

test("server errors reject rather than becoming empty charts", async () => {
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  await assert.rejects(getOverview(), /503/);
});

test("malformed server responses reject", async () => {
  globalThis.fetch = async () => new Response("<html>Proxy error</html>");
  await assert.rejects(getOverview(), SyntaxError);
});

test("a superseded filter request can be cancelled", async () => {
  const controller = new AbortController();
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const pending = getSkills("kg", "all", "all", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
