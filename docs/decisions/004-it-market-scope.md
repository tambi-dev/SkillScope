# ADR 004: Central Asian IT market scope

**Status:** accepted
**Date:** 2026-10-09

## Decision

SkillScope expands its role scope across Kazakhstan, Kyrgyzstan and Uzbekistan to five
focused areas:

- Data & AI: Data Analyst, BI Analyst, Data Scientist and ML Engineer
- Software Engineering: Backend, Frontend and Full-stack Developer
- DevOps & Cloud: DevOps Engineer
- Cybersecurity: Information Security Specialist
- QA: QA Engineer

Role categories, search terms, title patterns and overlap priority are maintained in
`src/skillscope/role_catalog.toml`. Existing Data role codes and their precedence remain intact.
Search provenance is retained, but only configured title patterns determine role inclusion.

## Guardrails

- The configured HeadHunter results are an observed search sample, not a census or total
  demand estimate. Reports must expose the sample denominator and snapshot date.
- Do not rank or compare very small role-by-country groups as though their samples were
  equally reliable. Record counts remain visible so the limitation can be judged.
- Salary statistics stay in each market's local currency. Report salary coverage and
  complete range counts alongside medians; do not pool currencies.
- Treat vacancies marked `noExperience` as having no experience requirement, not as a
  definitive junior classification. Keep the existing seniority estimate distinct.
- Add role families only when HeadHunter title coverage and manual review support them.
  Data Engineer, mobile roles, dedicated SRE, penetration testing and separate manual or
  automation QA roles remain deferred.
- Keep country as an analytical dimension and preserve existing Data role behavior.

## Consequences

The current demo snapshot and the 2026-10-01 baseline cover only the four Data roles.
Expanded-role charts require a new reviewed collection. Trends require repeated snapshots
with stable search definitions. Cross-country salary comparisons remain descriptive in
local currencies until a separately documented conversion method is adopted.

A one-page strict-title pilot was collected for the six new roles. Across the role and
expanded information-security searches, 264 unique vacancy titles were observed; the
current title rules assign 249 and leave 15 unclassified. These are search-card candidates,
not reviewed vacancy details or market totals. Information Security returned only three
Kyrgyzstan candidates, so that market should not be ranked on this sample. Search-card
salary snippets are not suitable for salary analysis.
