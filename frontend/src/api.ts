import type {
  MarketCode,
  CategoryCode,
  ModelInsights,
  Overview,
  RoleDemandResponse,
  RoleCode,
  SalaryGroup,
  SeniorityResponse,
  SkillsResponse,
  TaxonomyCategory,
} from "./types";

const apiBase = import.meta.env?.VITE_API_BASE_URL ?? "/api";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(`${apiBase}${path}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`SkillScope API returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

function filterQuery(
  market: MarketCode | "all",
  role: RoleCode | "all",
  category: CategoryCode | "all",
  limit?: number,
) {
  const params = new URLSearchParams();
  if (market !== "all") params.set("market", market);
  if (role !== "all") params.set("role", role);
  if (category !== "all") params.set("category", category);
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getOverview(signal?: AbortSignal) {
  return getJson<Overview>("/overview", signal);
}

export function getTaxonomy(signal?: AbortSignal) {
  return getJson<TaxonomyCategory[]>("/taxonomy", signal);
}

export function getRoles(market: MarketCode | "all", category: CategoryCode | "all", signal?: AbortSignal) {
  return getJson<RoleDemandResponse>(`/roles${filterQuery(market, "all", category)}`, signal);
}

export function getSkills(
  market: MarketCode | "all",
  role: RoleCode | "all",
  category: CategoryCode | "all",
  signal?: AbortSignal,
  limit = 8,
) {
  return getJson<SkillsResponse>(`/skills${filterQuery(market, role, category, limit)}`, signal);
}

export function getSalaries(
  market: MarketCode | "all",
  role: RoleCode | "all",
  category: CategoryCode | "all",
  signal?: AbortSignal,
) {
  return getJson<SalaryGroup[]>(`/salaries${filterQuery(market, role, category)}`, signal);
}

export function getSeniority(
  market: MarketCode | "all",
  role: RoleCode | "all",
  category: CategoryCode | "all",
  signal?: AbortSignal,
) {
  return getJson<SeniorityResponse>(`/seniority${filterQuery(market, role, category)}`, signal);
}

export function getModelInsights(signal?: AbortSignal) {
  return getJson<ModelInsights>("/model-insights", signal);
}
