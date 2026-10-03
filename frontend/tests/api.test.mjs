import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { getOverview, getSkills, getSalaries, getSeniority } from "../src/api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("all-market skills have a valid query and retain the zero denominator", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/skills?limit=8");
    return Response.json({ vacancy_denominator: 0, items: [] });
  };
  const result = await getSkills("all", "all");
  assert.equal(result.vacancy_denominator, 0);
  assert.deepEqual(result.items, []);
});

test("country and role filters reach all filtered endpoints", async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return Response.json([]); };
  await getSkills("kg", "bi_analyst");
  await getSalaries("kg", "bi_analyst");
  await getSeniority("kg", "bi_analyst");
  for (const url of urls) {
    const query = new URL(url, "http://test").searchParams;
    assert.equal(query.get("market"), "kg");
    assert.equal(query.get("role"), "bi_analyst");
  }
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
  const pending = getSkills("kg", "all", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
