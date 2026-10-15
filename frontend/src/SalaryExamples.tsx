import { useEffect, useState } from "react";
import { getSalaryExamples } from "./api";
import { useLanguage } from "./i18n";
import type { SalaryExample, SalaryExperience, SalaryGroup } from "./types";

export default function SalaryExamples({ row, experience }: { row: SalaryGroup; experience: SalaryExperience }) {
  const { language, t } = useLanguage();
  const [examples, setExamples] = useState<SalaryExample[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setExamples(null); setError(false);
    getSalaryExamples(row, experience, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setExamples(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [row, experience, retry]);
  const amount = (value: number) => new Intl.NumberFormat(language === "ky" ? "ky-KG" : "en", { maximumFractionDigits: 0 }).format(value).replaceAll(",", "\u202f");
  const experienceLabels: Record<string, string> = { noExperience: "No experience required", between1And3: "1–3 years required", between3And6: "3–6 years required", moreThan6: "More than 6 years required" };
  if (error) return <p className="salary-example-note" role="alert">{t("Examples could not load.")} <button className="career-link" type="button" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button></p>;
  if (!examples) return <p className="salary-example-note" role="status">{t("Loading vacancy examples…")}</p>;
  if (!examples.length) return <p className="salary-example-note">{t("No published examples for this selection.")}</p>;
  return <div className="salary-example-content">
    <p className="salary-example-note">{t("Anonymised vacancies from this snapshot. Examples show original published amounts, not a ranking or a prediction.")}</p>
    <ol className="salary-example-list">{examples.map((example, index) => <li key={index}>
      <span className="salary-example-label">{t("Vacancy example {number}", { number: index + 1 })}</span>
      <strong>{example.salary_from !== null && example.salary_to !== null ? `${amount(example.salary_from)}–${amount(example.salary_to)}` : example.salary_from !== null ? t("from {amount}", { amount: amount(example.salary_from) }) : t("up to {amount}", { amount: amount(example.salary_to!) })} <small className="salary-unit">{example.currency}</small></strong>
      <p>{t(experienceLabels[example.experience ?? ""] ?? "Experience requirement unavailable")}</p>
      <p>{example.skills.length ? t("Mentioned skills: {skills}", { skills: example.skills.join(", ") }) : t("No dictionary-matched skills recorded; this does not mean no skills are required.")}</p>
    </li>)}</ol>
  </div>;
}
