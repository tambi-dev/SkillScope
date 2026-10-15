# Product

## Platform

web

## Users

Students and early-career Data/IT specialists exploring selected markets in Kyrgyzstan, Kazakhstan, Uzbekistan, Tajikistan, Turkmenistan, Georgia and Russia.

## Product Purpose

SkillScope helps beginners choose an IT direction to try and a concrete next learning step. Visitors compare the work, complete a small practice task and reflect on the experience, with HeadHunter vacancy evidence showing what is observed in their chosen market.

## Positioning

SkillScope is scoped to five Central Asian markets plus Georgia and Russia, and ten IT roles in five fields. It compares observed vacancy signals where reviewed data exists, using explicit classification rules and reported local-currency salary ranges so users can inspect how results relate to vacancy evidence.

## Operating Context

The default entry is My route: visitors choose Data analysis, Web development or Software testing. Each field has a plain-language explanation, an everyday example and a short guided task that runs in the browser. Only one stage is shown at a time: explanation, task or next learning step. Vacancy evidence and deeper learning topics are optional disclosures. A separate expandable section retains comparison and known-skill exploration for all ten roles. Overview, Roles & skills, and Salaries support further investigation. Market Radar circle areas show frequency; positions are illustrative.

## Capabilities and Constraints

- The scope covers Data & AI, Software Engineering, DevOps & Cloud, Cybersecurity and QA across seven countries. The packaged 2026-10-12 snapshot contains all ten roles, with matching vacancies in Kyrgyzstan, Kazakhstan, Uzbekistan, Georgia and Russia. No configured role matched in Tajikistan or Turkmenistan on HeadHunter in this collection.
- HeadHunter search and vacancy detail APIs provide the source records. Results represent configured searches, not every hiring channel.
- Role and skill classification uses explicit rules and dictionaries. Seniority is inferred from titles, descriptions and broad experience bands.
- The three field guides are editorial content with English and Kyrgyz explanations and guided in-browser practice. There is no interest questionnaire or aptitude ranking. Tasks use a fictional sales table, a sandboxed HTML preview and an intentionally faulty age check. Drafts, reflections, next steps and marked skills stay in the browser; users can clear them on the privacy page.
- Country vacancy counts, no-experience requirements and skill counts come from existing API responses and update with the deployed snapshot. The editorial exercises do not depend on sample size. Missing data stays unavailable rather than becoming a zero.
- Salary summaries use complete advertised ranges in local currency. Groups remain separate by currency; an optional USD display uses a saved reference rate dated to the vacancy snapshot. Missing values are not imputed, and current coverage is too small for a salary prediction model.
- Country menus follow descending vacancy counts in the overall snapshot, keeping empty markets last. Role filters do not reshuffle menus. Salaries use one table with country, role and published amounts. Each range or one-sided limit is visible with its own vacancy count beneath it; currencies remain separate and experience-level context stays visible.
- Salaries default to All experience levels, with an explicit No experience required filter. Each row can reveal real anonymised records matching its scope, showing original salary amounts, experience requirements and dictionary-matched skill mentions. Samples and examples follow the weekly snapshot automatically. Inferred Junior labels do not substitute for no-experience requirements.
- Practice completion has a brief checkmark/confetti response and locally generated sound, enabled by default with a remembered mute control. Reduced-motion preferences retain a static checkmark. The default theme is dark, with manual theme choices remembered. Mr. Scope sends on Enter and inserts a line break on Shift+Enter.
- Historical comparisons depend on available snapshots. Strict collection runs retain deduplicated observations with publication and collection dates, skills, roles, seniority and salary fields. The existing time series is still too limited for growth claims.
- Raw vacancy payloads and full text remain local. Published demo data omits identifying vacancy details.

## Brand Commitments

The product name is SkillScope.

## Evidence on Hand

- Project scope, source and transformation policy: `docs/data-card.md`.
- Dashboard and API source: `frontend/src/` and `src/skillscope/`.
- Processed snapshot and aggregate reports: `data/processed/` and `artifacts/reports/`.
- The 2026-10-12 seven-country collection found 2,541 candidates; 2,297 passed
  the title rules and are included in the packaged identity-stripped demo. None
  matched the configured roles in Tajikistan or Turkmenistan.

## Product Principles

- Help early-career specialists connect observed demand to learning and role choices.
- Give each beginner a task to try and a next step they can explain. AI can assist with the exercise; the learner checks its output against data, requirements and observed behaviour.
- Keep comparisons grounded in vacancy counts, snapshot dates and market coverage.
- Explain inferred categories and preserve uncertainty in salary and seniority data.
- Keep original salaries visible beside optional USD conversions and avoid unsupported growth claims.
