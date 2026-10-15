import { useState } from "react";
import { useLanguage } from "./i18n";
import SalaryExamples from "./SalaryExamples";
import type { MarketCode, SalaryExperience, SalaryGroup } from "./types";

interface Props {
  rows: SalaryGroup[];
  markets: Array<{ value: MarketCode; label: string }>;
  roleLabels: Map<string, string>;
  showUsd: boolean;
  formatAmount: (amount: number, currency: string) => string;
  experience: SalaryExperience;
}

export default function SalaryTable({ rows, markets, roleLabels, showUsd, formatAmount, experience }: Props) {
  const { t } = useLanguage();
  const [openExample, setOpenExample] = useState<string | null>(null);
  const currencyLabel = (currency: string) => currency === "RUR" ? "RUB" : currency;
  function signal(row: SalaryGroup, kind: "range" | "from" | "to") {
    if (kind === "from") return t("from {amount}", { amount: formatAmount(row.median_from_only_local!, row.currency) });
    if (kind === "to") return t("up to {amount}", { amount: formatAmount(row.median_to_only_local!, row.currency) });
    return typeof row.median_range_from_local === "number" && typeof row.median_range_to_local === "number"
      ? `${formatAmount(row.median_range_from_local, row.currency)}–${formatAmount(row.median_range_to_local, row.currency)}`
      : formatAmount(row.median_midpoint_local!, row.currency);
  }
  const count = (row: SalaryGroup, kind: "range" | "from" | "to") => kind === "range" ? row.complete_salary_ranges : kind === "from" ? row.from_only_count ?? 0 : row.to_only_count ?? 0;
  const orderedRows = markets.flatMap((market) => rows.filter((row) => row.market === market.value)
    .sort((a, b) => a.role_family.localeCompare(b.role_family) || a.currency.localeCompare(b.currency)));
  return <table className="salary-summary-table">
    <caption className="sr-only">{t("Salary summaries for the selected market, field and role")}</caption>
    <thead><tr><th scope="col">{t("Market")}</th><th scope="col">{t("Role")}</th><th scope="col">{t("Published salary amounts")}</th></tr></thead>
    <tbody>{orderedRows.map((row, index) => {
      const kinds = (["range", "from", "to"] as const).filter((kind) => kind === "range" ? row.median_midpoint_local !== null : typeof (kind === "from" ? row.median_from_only_local : row.median_to_only_local) === "number");
      const exampleKey = `${row.market}-${row.role_family}-${row.currency}`;
      return <tr key={`${row.market}-${row.role_family}-${row.currency}`} data-market={row.market} data-role={row.role_family} data-currency={row.currency} data-market-start={index > 0 && orderedRows[index - 1].market !== row.market}>
        <td className="salary-market">{t(markets.find((market) => market.value === row.market)?.label ?? row.market)}</td>
        <th scope="row" className="salary-role">{roleLabels.get(row.role_family) ?? row.role_family}</th>
        <td className="salary-summary-value">
          {showUsd && <span className="salary-source">{t("Reported in {currency}", { currency: currencyLabel(row.currency) })}</span>}
          {kinds.length ? kinds.map((kind, position) => <div className="salary-figure" data-kind={kind} data-primary={position === 0} key={kind}>
            <span className="salary-summary-kind">{t(kind === "range" ? "Both limits listed · medians" : kind === "from" ? "Minimum only · median" : "Maximum only · median")}</span>
            <strong><span className="salary-amount">{signal(row, kind)}</span><small className="salary-unit">{showUsd ? "USD" : currencyLabel(row.currency)}</small></strong>
            <small className="salary-sample">{t(count(row, kind) === 1 ? "Based on 1 vacancy" : "Based on {count} vacancies", { count: count(row, kind) })}</small>
          </div>) : t("Salary amount unavailable")}
          <details className="salary-examples" open={openExample === exampleKey} onToggle={(event) => { const opened = event.currentTarget.open; setOpenExample((current) => opened ? exampleKey : current === exampleKey ? null : current); }}>
            <summary>{t("View vacancy examples")}</summary>
            {openExample === exampleKey && <SalaryExamples row={row} experience={experience} />}
          </details>
        </td>
      </tr>;
    })}</tbody>
  </table>;
}
