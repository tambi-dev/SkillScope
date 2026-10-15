import { test } from "node:test";
import assert from "node:assert/strict";
import { readCareerProgress } from "../src/careerGuides.ts";
import { checkSales, previewDocument, salesRows } from "../src/careerActivities.ts";

test("the sales exercise accepts either copy of the duplicate and checks real totals", () => {
  assert.deepEqual(checkSales([0, 1, 2, 3, 5], "15", "10"), { clean: true, totals: true });
  assert.deepEqual(checkSales([0, 1, 2, 4, 5], "15", "10"), { clean: true, totals: true });
  assert.equal(checkSales([0, 1, 2, 3, 4, 5], "15", "18").clean, false);
  assert.equal(checkSales([0, 1, 2, 3, 4], "15", "10").clean, false);
  assert.equal(checkSales([0, 1, 2, 3, 5], "15", " ").totals, false);
  assert.equal(salesRows.length, 6);
});

test("HTML preview locks down resources, forms and its base URL", () => {
  const html = previewDocument("<h1>My first page</h1>");
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'; base-uri 'none'/);
  assert.match(html, /<h1>My first page<\/h1>/);
});

test("previous route reflections survive migration without resuming the old exercise", () => {
  const result = readCareerProgress(JSON.stringify({ answers: ["qa_engineer"], compared: true, selected: "qa_engineer", trials: { qa_engineer: { note: "I like investigating", decision: "continue", saved: true } } }));
  assert.equal(result.version, 2);
  assert.equal(result.view, "learn");
  assert.equal(result.trials.qa_engineer.note, "I like investigating");
  assert.equal(result.trials.qa_engineer.completed, false);
});

test("stored state rejects invalid routes, views and drafts", () => {
  assert.deepEqual(readCareerProgress("not json"), readCareerProgress(null));
  const result = readCareerProgress(JSON.stringify({ version: 2, selected: "qa_engineer", view: "next", trials: { qa_engineer: { note: "x".repeat(500), draft: { runs: [15, 16, 99, "15"], code: "y".repeat(4000), included: [0, -1, "2", 4, 4, 99] } } } }));
  assert.equal(result.view, "learn", "An incomplete task cannot reopen a completed-task screen");
  assert.equal(result.trials.qa_engineer.note.length, 400);
  assert.equal(result.trials.qa_engineer.draft.code.length, 3000);
  assert.deepEqual(result.trials.qa_engineer.draft.runs, [15, 16]);
  assert.deepEqual(result.trials.qa_engineer.draft.included, [0, 4]);
  assert.equal(readCareerProgress('{"selected":"unknown","view":"practice"}').view, "fields");
});

test("drafts and completed plans remain separate for each field", () => {
  const progress = { version: 2, view: "next", selected: "qa_engineer", trials: {
    data_analyst: { note: "Numbers", decision: "", saved: false, completed: false, draft: { tea: "10" } },
    qa_engineer: { note: "Rules", decision: "continue", saved: true, completed: true, draft: { age: "16", runs: [15, 16], expected: "Reject 15", actual: "Accepted" } },
  } };
  assert.deepEqual(readCareerProgress(JSON.stringify(progress)), progress);
});
