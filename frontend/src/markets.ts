import type { MarketCode, Overview } from "./types";

export const configuredMarkets: Array<{ value: MarketCode; label: string }> = [
  { value: "kg", label: "Kyrgyzstan" },
  { value: "kz", label: "Kazakhstan" },
  { value: "uz", label: "Uzbekistan" },
  { value: "ge", label: "Georgia" },
  { value: "ru", label: "Russia" },
  { value: "tj", label: "Tajikistan" },
  { value: "tm", label: "Turkmenistan" },
];

// The overview is unfiltered: menus keep the same order as visitors change roles.
export function orderMarkets(overview?: Overview | null) {
  return [...configuredMarkets].sort((a, b) =>
    (overview?.salary_coverage_by_market[b.value]?.included_vacancies ?? 0)
    - (overview?.salary_coverage_by_market[a.value]?.included_vacancies ?? 0));
}
