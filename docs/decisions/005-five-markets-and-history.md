# 005 — Five markets and persistent observations

## Decision

SkillScope includes Kyrgyzstan, Kazakhstan, Uzbekistan, Tajikistan and Turkmenistan in
its configured collection scope and dashboard filters. The new markets use HeadHunter
country areas 86 and 93. They remain unsampled in published analytics until collection
and manual review produce evidence.

The latest reviewed processed snapshot remains the input to existing API endpoints.
Each collection also retains a local processed JSONL file, while SQLite stores one
vacancy per market and HeadHunter ID and one analytical observation per collection,
market and vacancy. Rerunning a collection replaces its observation rather than adding
a duplicate. Collection coverage records candidate and included counts for each
audited market, including zero. Published-at and observed-at timestamps stay distinct.

SQLite observations retain the fields needed for later role, skill, salary and seniority
time series. The schema migrates older history databases in place; older observations
have null values for fields that were not stored before migration. Reprocessing an old
source collection can populate those fields. Trend views are deferred until enough
reviewed, comparable snapshots exist.

## Consequences

- The database and raw or processed snapshots are private, gitignored local data. A
  scheduled collector needs persistent storage and backups; the demo deployment does
  not provide that storage.
- A market with no reviewed records is labelled as having no reviewed sample. Small
  samples show counts, and advertised salaries remain separate by currency.
- HeadHunter searches do not cover the full labour market. Newly configured market
  endpoints and title matches require a live pilot and manual review before claims are
  published.
