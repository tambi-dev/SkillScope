import { useEffect, useState } from "react";
import { getExchangeRates, getSalaries } from "./api";
import SalaryTable from "./SalaryTable";
import { useLanguage } from "./i18n";
import type { ExchangeRates, MarketCode, SalaryExperience, SalaryGroup } from "./types";

interface Props {
  active: boolean;
  selection: { market: MarketCode | "all"; role: string; category: string };
  allRows: SalaryGroup[];
  snapshotDate: string | null;
  markets: Array<{ value: MarketCode; label: string }>;
  roleLabels: Map<string, string>;
  modelExplanation: string;
}

export default function SalaryPanel({ active, selection, allRows, snapshotDate, markets, roleLabels, modelExplanation }: Props) {
  const { language, t, formatDate } = useLanguage();
  const [experience, setExperience] = useState<SalaryExperience>("all");
  const [salaryCurrency, setSalaryCurrency] = useState<"local" | "usd">("local");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [remote, setRemote] = useState<{ key: string; rows?: SalaryGroup[]; error?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const { market, role, category } = selection;
  const filterKey = `${market}/${role}/${category}/${snapshotDate}/${experience}`;
  useEffect(() => {
    const controller = new AbortController();
    getExchangeRates(controller.signal).then(setExchangeRates).catch(() => setExchangeRates(null));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!active || experience === "all") return;
    const controller = new AbortController();
    setRemote(null);
    getSalaries(market, role, category, controller.signal, experience)
      .then((rows) => { if (!controller.signal.aborted) setRemote({ key: filterKey, rows }); })
      .catch(() => { if (!controller.signal.aborted) setRemote({ key: filterKey, error: true }); });
    return () => controller.abort();
  }, [active, market, role, category, experience, filterKey, retry]);
  const sourceRows = experience === "all" ? allRows : remote?.key === filterKey ? remote.rows : undefined;
  const error = experience !== "all" && remote?.key === filterKey && remote.error;
  const salaryStats = { reported: 0, denominator: 0, complete: 0 };
  for (const row of sourceRows ?? []) {
    salaryStats.reported += row.vacancies_with_reported_salary;
    salaryStats.denominator += row.included_vacancies;
    salaryStats.complete += row.complete_salary_ranges;
  }
  const salaryRows = sourceRows?.filter((row) => row.vacancies_with_reported_salary > 0) ?? [];
  const salaryCoverage = salaryStats.denominator ? salaryStats.complete / salaryStats.denominator : 0;
  const ratesForSnapshot = exchangeRates?.date === snapshotDate?.slice(0, 10) ? exchangeRates : null;
  const canShowUsd = !!ratesForSnapshot && salaryRows.length > 0 && salaryRows.every((row) => {
    const rate = ratesForSnapshot.rates_per_usd[row.currency === "RUR" ? "RUB" : row.currency];
    return Number.isFinite(rate) && rate > 0;
  });
  const showUsd = salaryCurrency === "usd" && canShowUsd;
  const formatSalaryAmount = (amount: number, currency: string) => {
    const code = currency === "RUR" ? "RUB" : currency;
    const value = showUsd ? amount / ratesForSnapshot!.rates_per_usd[code] : amount;
    return new Intl.NumberFormat(language === "ky" ? "ky-KG" : "en", { maximumFractionDigits: 0 }).format(value).replaceAll(",", "\u202f");
  };
  return (
          <section className="salary-panel" id="salary" aria-labelledby="salary-heading">
            <div className="section-heading"><div><h2 id="salary-heading">{t("Advertised salary evidence")}</h2><p>{t("Compare published salaries, then open real examples to see their experience requirements and skill mentions.")}</p></div><div className="salary-currency-switch" role="group" aria-label={t("Salary display currency")}><button type="button" aria-pressed={!showUsd} onClick={() => setSalaryCurrency("local")}>{t("Local currency")}</button><button type="button" aria-pressed={showUsd} disabled={!canShowUsd} onClick={() => setSalaryCurrency("usd")}>USD</button></div></div>
            <div className="salary-experience-filter"><label htmlFor="salary-experience">{t("Experience requirements")}</label><select id="salary-experience" value={experience} onChange={(event) => setExperience(event.target.value as SalaryExperience)}><option value="all">{t("All experience levels")}</option><option value="noExperience">{t("No experience required")}</option></select></div>
            <p className="salary-experience-note">{t(experience === "noExperience" ? "Only vacancies explicitly marked no experience required. A Junior title alone is not enough." : "These summaries include different experience levels. They are not junior salary expectations.")}</p>
            {error ? <p className="empty-state" role="alert">{t("Salary data could not load.")} <button className="career-link" type="button" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button></p> : !sourceRows ? <p className="salary-experience-note" role="status">{t("Loading salaries for this experience group…")}</p> : <div className="salary-results" aria-busy="false">
            <div className="salary-evidence">
              <h3 className="section-insight">{salaryStats.denominator ? <><strong className="coverage-total">{salaryStats.reported}<small>{t("of")} {salaryStats.denominator}</small></strong><span>{t("vacancies include a published salary amount.")}</span></> : t("No salary sample for these filters.")}</h3>
              <p>{t(salaryStats.reported === 0 ? "No published salaries in this view." : salaryStats.complete === 0 ? "Only one-sided salary amounts are available here; they are not full ranges." : salaryStats.complete < 10 ? "Limited evidence: treat these values as individual salary signals, not typical market pay." : showUsd ? "USD conversion is approximate. It does not account for living costs or taxes." : "Compare within the same currency and check how many ads support each value.")}</p>
              {salaryStats.denominator > 0 && <div className="coverage-breakdown"><div className="coverage-meter" role="img" aria-label={t("{complete} complete ranges, {partial} incomplete ranges, {missing} undisclosed out of {total} vacancies", { complete: salaryStats.complete, partial: salaryStats.reported - salaryStats.complete, missing: salaryStats.denominator - salaryStats.reported, total: salaryStats.denominator })}><span style={{ width: `${salaryCoverage * 100}%` }} /><span className="coverage-partial" style={{ width: `${(salaryStats.reported - salaryStats.complete) / salaryStats.denominator * 100}%` }} /></div>
                <div className="coverage-labels"><span><i className="coverage-key complete" /><strong>{salaryStats.complete}</strong> {t("complete")} <small>{t("{share}% of this view", { share: Math.round(salaryCoverage * 100) })}</small></span><span><i className="coverage-key partial" /><strong>{salaryStats.reported - salaryStats.complete}</strong> {t("incomplete")}</span><span><i className="coverage-key absent" /><strong>{salaryStats.denominator - salaryStats.reported}</strong> {t("not disclosed")}</span></div>
              </div>}
            </div>
            <details className="salary-reading"><summary>{t("How to read these figures")}</summary>
              <p className="comparison-note">{t("One row groups ads by market, role and currency. Full ranges, from-only amounts and up-to-only amounts are summarized separately; each figure is the middle value in its group.")} {showUsd && <>{t("Exchange rates: {source}, {date}.", { source: ratesForSnapshot!.source, date: formatDate(ratesForSnapshot!.date) })} <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">{t("Rate source")}</a>.</>}{!canShowUsd && salaryRows.length > 0 && <> {t("USD conversion is unavailable for this snapshot.")}</>}</p>
              <p>{t("Each figure uses only the vacancies counted beneath it. A lower or upper limit is not a complete salary range.")}</p>
            </details>
            {salaryRows.length > 0 ? <SalaryTable key={filterKey} experience={experience} rows={salaryRows} markets={markets} roleLabels={roleLabels} showUsd={showUsd} formatAmount={formatSalaryAmount} /> : <div className="empty-state"><p>{t(experience === "noExperience" ? "No published salaries from vacancies explicitly asking for no experience in this selection." : "No published salary amounts for these filters.")}</p>{experience === "noExperience" && <button type="button" className="career-link" onClick={() => setExperience("all")}>{t("Compare all experience levels")}</button>}</div>}
            <details className="model-note"><summary>{t("Why there is no salary prediction yet")}</summary><p>{t(modelExplanation)}</p></details>
            </div>}
          </section>
  );
}
