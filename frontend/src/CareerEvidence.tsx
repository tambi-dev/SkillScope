import { useEffect, useState } from "react";
import { getOverview, getRoles, getSkills } from "./api";
import type { GuideId } from "./careerGuides";
import { useLanguage } from "./i18n";
import type { MarketCode, RoleDemandItem, SkillsResponse } from "./types";

interface Props {
  guide: GuideId; market: MarketCode | "all"; markets: Array<{ value: MarketCode; label: string }>;
  onMarketChange: (market: MarketCode | "all") => void; onExploreRole: () => void;
}
export default function CareerEvidence({ guide, market, markets, onMarketChange, onExploreRole }: Props) {
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState<{ market: string; guide: GuideId; date: string | null; role?: RoleDemandItem; skills: SkillsResponse } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    Promise.all([getOverview(controller.signal), getRoles(market, "all", controller.signal), getSkills(market, guide, "all", controller.signal, 3)])
      .then(([overview, roles, skills]) => { if (!controller.signal.aborted) setData({ market, guide, date: overview.last_seen_at, role: roles.items.find((item) => item.code === guide), skills }); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [guide, market, retry]);
  const current = data?.market === market && data.guide === guide ? data : null;
  return <div className="career-evidence">
    <label>{t("Country for vacancy data")}<select aria-label={t("Career market")} value={market} onChange={(event) => onMarketChange(event.target.value as MarketCode | "all")}><option value="all">{t("Combined sample")}</option>{markets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    {error ? <p role="alert">{t("Vacancy data could not load. The field guide and task still work.")} <button type="button" className="career-link" onClick={() => setRetry((value) => value + 1)}>{t("Retry evidence")}</button></p>
      : !current ? <p role="status">{t("Loading vacancy evidence…")}</p>
        : <><p className="career-evidence-date">{t("Observed {date} · HeadHunter", { date: formatDate(current.date) })}</p>
          {!current.role ? <p>{t("This role has no classified evidence here.")}</p> : !current.role.vacancies ? <p>{t("No matching vacancies here. This does not mean no hiring; the exercise is still available.")}</p> : <>
            <p>{t("{count} observed vacancies", { count: current.role.vacancies })}</p>
            <p>{current.role.experience_observed_vacancies ? t("{count} of {total} with known experience requirements ask for no experience.", { count: current.role.no_experience_required, total: current.role.experience_observed_vacancies }) : t("Experience requirements unavailable.")}</p>
            {current.role.experience_observed_vacancies < current.role.vacancies && <p>{t("Experience requirements are unknown for {count} vacancies.", { count: current.role.vacancies - current.role.experience_observed_vacancies })}</p>}
            {current.role.vacancies < 20 && <p className="career-note">{t("Small sample: rankings may shift with one vacancy.")}</p>}
            {current.skills.items.length > 0 && <><h3>{t("Frequently mentioned skills")}</h3><ul className="career-skill-evidence">{current.skills.items.map((item) => <li key={item.skill}><span>{item.skill}</span><span>{item.vacancies_with_skill} / {current.skills.vacancy_denominator}</span></li>)}</ul></>}
          </>}
        </>}
    <p className="career-note">{t("These are sampled vacancies, not your chance of getting hired. Frequently mentioned skills are not a first-day learning checklist.")}{market === "all" && " " + t("The combined sample mixes countries unevenly. ")}</p>
    <button type="button" className="career-link" onClick={onExploreRole}>{t("Explore this role’s skill evidence")}</button>
  </div>;
}
