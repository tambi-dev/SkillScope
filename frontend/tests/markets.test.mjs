import { test } from "node:test";
import assert from "node:assert/strict";
import { configuredMarkets, orderMarkets } from "../src/markets.ts";

test("country ordering follows new snapshot counts, including countries previously empty", () => {
  const overview = { salary_coverage_by_market: { kg: { included_vacancies: 5 }, kz: { included_vacancies: 50 }, ru: { included_vacancies: 300 }, tj: { included_vacancies: 70 } } };
  assert.deepEqual(orderMarkets(overview).map((item) => item.value), ["ru", "tj", "kz", "kg", "uz", "ge", "tm"]);
  assert.equal(configuredMarkets[0].value, "kg", "Sorting must not mutate configuration");
});

test("unknown coverage preserves all seven countries without inventing a ranking", () => {
  assert.deepEqual(orderMarkets(null), configuredMarkets);
  assert.deepEqual(orderMarkets({ salary_coverage_by_market: {} }), configuredMarkets);
});
