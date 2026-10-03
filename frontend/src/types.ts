export type MarketCode = "kg" | "kz" | "uz";
export type RoleCode =
  | "data_analyst"
  | "bi_analyst"
  | "data_scientist"
  | "ml_engineer";

export type SeniorityLevel = "Junior" | "Middle" | "Senior" | "Unknown";

export interface Overview {
  data_mode: "processed" | "demo";
  last_seen_at: string | null;
  candidate_vacancies: number;
  included_vacancies: number;
  excluded_candidates: number;
  markets: string[];
  role_counts: Record<string, number>;
  seniority_counts: Record<string, number>;
  salary_coverage_by_market: Record<
    string,
    {
      currency: string | null;
      included_vacancies: number;
      with_reported_salary: number;
      coverage: number | null;
    }
  >;
}

export interface SkillsResponse {
  market: string | null;
  role: string | null;
  vacancy_denominator: number;
  items: Array<{
    skill: string;
    vacancies_with_skill: number;
    share: number;
  }>;
}

export interface SalaryGroup {
  market: string;
  currency: string;
  role_family: string;
  included_vacancies: number;
  vacancies_with_reported_salary: number;
  complete_salary_ranges: number;
  coverage: number | null;
  median_midpoint_local: number | null;
}

export interface SeniorityResponse {
  market: string | null;
  role: string | null;
  vacancy_denominator: number;
  items: Array<{
    seniority: SeniorityLevel;
    vacancies: number;
    share: number;
    mean_skill_count: number | null;
  }>;
}

export interface ModelInsights {
  status: "not_ready";
  target: string;
  complete_salary_ranges: number;
  imputation_used: false;
  explanation: string;
}
