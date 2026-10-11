# Snapshot validation — 2026-10-10

## Scope and method

Reviewed 40 vacancies from the 358 candidates in the five-country strict audit:
four automatically included vacancies per role, drawing from each market where that
role had observations and filling remaining slots with a fixed random seed
(`20261010`). The reviewer compared titles and duties with the assigned role and
checked extracted skill evidence against vacancy text and HeadHunter key-skill tags.
The annotated worksheet is local at `data/processed/manual_review_latest.csv`; it
contains vacancy identities and is excluded from Git.

## Findings and corrections

- Before correction, 39 of 40 sampled role assignments were supported by the vacancy
  descriptions. One Frontend match described only UI/UX design and Figma handoff.
  The classifier now excludes this design-only hybrid. Reprocessing the cached raw
  collection changed the included count from 339 to 338; the current worksheet has
  no role-decision disagreement in these 40 rows.
- The skill dictionary missed explicit mentions of Angular, Vue, NestJS, FastAPI,
  Django, Laravel, Redis, Kafka, RabbitMQ, Ansible, Helm, Grafana and Prometheus.
  These 13 exact technologies were added and the snapshot was regenerated.
- HeadHunter key-skill tags can be broader than the actual duties. For example, one
  Angular vacancy also tagged React and Node.js. The dashboard counts mentions in
  vacancy text or tags; it cannot establish that every mentioned skill is required.

This stratified sample checks each role family but is too small and deliberately
balanced to estimate classifier precision for the full collection. The skill check
found dictionary omissions; it is not a measured precision or recall study. No
trend or salary conclusion follows from this validation.
