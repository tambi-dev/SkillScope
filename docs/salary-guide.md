# Salary summaries and vacancy examples

The salary page opens at All experience levels. The No experience required filter
selects vacancies explicitly marked `experience=noExperience`.
An inferred Junior label does not qualify a vacancy for this group. Unknown
experience requirements are excluded from the no-experience filter and retained in All experience
levels. Empty samples remain empty; the page offers an explicit switch to all levels.
The experience control affects only the salary view.

Each table row groups the selected country, role and original currency. RUR and RUB
are treated as the same currency. Published full ranges, lower limits and upper
limits are summarised separately. Full ranges show the median lower and median
upper limit; these endpoints need not come from one vacancy. One-sided figures are
the median of their own subgroup. Every figure has its own supporting vacancy count.
They do not form one combined minimum-to-maximum range.

View vacancy examples loads up to three actual records matching the row's country,
role, currency and experience filter. It selects one record per available salary
format, then fills from snapshot order. These are examples, not representative
estimates, a ranking, live offers or a prediction. Examples retain their original
published currency even when the summaries are displayed in approximate USD.

The API returns only market, role, currency, salary limits, explicit experience
requirements and up to five dictionary-matched skill mentions. It never returns
vacancy IDs, titles, companies, links or descriptions, including when the local
server reads the full processed dataset. Missing skill matches do not mean no skills
are required. The examples work with the existing identity-stripped demo snapshot.

Summary and example endpoints read the same current snapshot. Weekly collection and
deployment update both automatically; no example salary values are authored by hand.
Coverage includes vacancies without published pay and uses the selected experience
group. The overall dashboard keeps its own unfiltered experience coverage.

Checks cover experience filtering, unknown requirements, currency aliases,
one-sided salaries, absence of private fields, limit/filter validation, scoped
example loading, errors/retry, empty samples, cancellation, USD conversion and
desktop/mobile English/Kyrgyz rendering.
