import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_META, prompts, renderPrompt } from "../src/prompts.js";

test("prompts catalog includes Flow 1 prompts", () => {
  const names = prompts.map((p) => p.name);
  assert.ok(names.includes("explore_acceptance_criteria"));
  assert.ok(names.includes("write_test_cases"));
  assert.ok(names.includes("publish_test_cases"));
  assert.ok(names.includes("generate_automation"));
  assert.equal(PROMPT_META.explore_acceptance_criteria?.domain, "qa");
});

test("renderPrompt explore_acceptance_criteria includes story id and plan_qa_workflow", () => {
  const msgs = renderPrompt("explore_acceptance_criteria", { user_story_id: "471244" });
  const text = msgs[0]?.content.type === "text" ? msgs[0].content.text : "";
  assert.match(text, /plan_qa_workflow\(intent=explore_story/);
  assert.match(text, /US_471244/);
  assert.match(text, /@ac-explorer/);
});

test("renderPrompt write_test_cases references TestCasesDraft", () => {
  const msgs = renderPrompt("write_test_cases", { user_story_id: "US 471244" });
  const text = msgs[0]?.content.type === "text" ? msgs[0].content.text : "";
  assert.match(text, /TestCasesDraft/);
  assert.match(text, /@testcase-writer/);
});

test("renderPrompt unknown prompt throws", () => {
  assert.throws(() => renderPrompt("not_a_prompt", {}), /unknown_prompt/);
});
