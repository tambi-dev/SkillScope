# Beginner route

The outcome is one field to try and a small next learning step. The default
My route page offers Data analysis, Web development and Software testing with
one-sentence descriptions. Visitors choose out of curiosity; no questionnaire,
aptitude score or vacancy ranking decides a field for them.

## Why the flow changed

The first version mixed three role comparisons, vacancy counts, skill lists,
exercise instructions and reflection on a long page. Its interest questions
assumed visitors already understood the work. Downloading a dataset or fixing
HTML validation also required knowledge that a first-time visitor might lack.
User feedback identified these as confusing and too busy.

The revised flow shows one selected field and stage at a time:

1. **Understand:** a plain explanation, three everyday tasks and a concrete example.
2. **Try:** a guided exercise with all tools, instructions and hints on the page.
3. **Continue:** an optional reflection and one next learning activity to save or download.

Foundations, AI guidance and current vacancy figures sit in optional disclosures
on the explanation page. Detailed exploration of all ten roles remains available
on the field chooser. Existing analysis tabs remain accessible.

## Practice tasks

- **Data analysis:** inspect six fictional café sales rows. Order A04 appears
  twice; keep either copy and each other order once. The five unique orders
  total Coffee $15 and Tea $10. The visitor excludes the repeat and enters both
  totals. Feedback distinguishes an incorrect selection from incorrect sums.
- **Web development:** edit the text between HTML heading and button tags, then
  update an iframe preview. The explicit targets are `Build your first web page`
  and `Save my place`. Instructions explain the tags before editing, and Reset
  sample restores the starter. The sandbox disallows scripts and the preview's
  content security policy blocks resource loading and form submission.
- **Software testing:** a workshop rule accepts ages 16 and above; the practice
  form deliberately accepts 15. The visitor tries both ages and compares the
  results with the written rule, then writes expected and actual behaviour.
  An example report supports self-checking; free-text wording is not graded.

The examples are authored learning material, not real businesses, real bookings
or employment evidence. Roughly ten minutes is an introductory estimate, not
a deadline. The tasks illustrate a small part of each field and do not assess
job readiness or predict a visitor's career fit.

English and Kyrgyz explainers and instructions are provided. The HTML example
uses explicit English target text so the code exercise stays consistent.

Successful practice receives a brief checkmark and small confetti burst once per
attempt. Rechecking an answer does not replay it. Reduced motion shows a static
checkmark. A two-note chime is on by default; the mute control and `skillscope-sound`
remember the visitor's choice locally, and the privacy page clears it. No audio files or services
are requested.

Learning references:

- [Microsoft Learn: Data Analyst](https://learn.microsoft.com/en-us/training/career-paths/data-analyst).
- [MDN: Basic HTML syntax](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax).
- [ISTQB Foundation syllabus, v4.0.1 (PDF)](https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf).

## Optional vacancy evidence

Opening the vacancy disclosure requests `/api/overview`, `/api/roles` and
role-specific `/api/skills`. Counts, dates and skill denominators follow the
selected country and deployed snapshot. Explicit no-experience counts use only
vacancies with known requirements; unknown requirements are labelled separately.
Missing or failed evidence never becomes a zero. Changing country aborts the
previous request, and a failed load offers retry without blocking the task.
No snapshot figures are hardcoded into the field explanations or task data.

## Local progress and verification

The selected field, view, task drafts and reflections use the existing
`skillscope-career-route` localStorage key. Earlier reflections migrate, while
the old exercise reopens at the field explanation. Drafts are bounded and
validated on read, kept separate per field and never sent to the API or AI.
The privacy page clears them. Without storage, the flow remains usable for the
session and completed learning plans can be downloaded.

Checks cover the task reference answers, HTML preview policy, stored-state
validation and migration, wrong and partial answers, all three full browser
journeys, optional data with retry and empty samples, privacy, unavailable
API/storage, English/Kyrgyz, light/dark and desktop/mobile layouts.

Further validation should observe people with no IT background: can they explain
what a field does, follow its task without outside setup and describe their next
step? Automated checks and visual review do not establish learning effectiveness.
