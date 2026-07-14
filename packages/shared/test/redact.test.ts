import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPolicy } from "../src/policy.js";
import { classifyAndRedact, containsPii } from "../src/redact.js";
import { normalizeError, signature } from "../src/signature.js";

const policy = loadPolicy();

test("containsPii flags an SSN in an error string", () => {
  const { hit } = containsPii("login failed for SSN 123-45-6789", policy);
  assert.equal(hit, true);
});

test("containsPii flags secrets in key:value form", () => {
  assert.equal(containsPii("token: abc.def", policy).hit, true);
  assert.equal(containsPii("api_key=sk_live_123", policy).hit, true);
  assert.equal(containsPii("password = hunter2", policy).hit, true);
});

test("containsPii ignores benign error text", () => {
  assert.equal(containsPii("TimeoutError: locator not visible after 5000ms", policy).hit, false);
});

test("normalizeError masks SSN, long numbers and URLs", () => {
  const out = normalizeError("failed 123-45-6789 at https://staging.example/x id 99887766554");
  assert.ok(out.includes("[SSN]"));
  assert.ok(out.includes("[URL]"));
  assert.ok(out.includes("[NUM]"));
});

test("signature is stable and prefixed", () => {
  const a = signature("t1", "TimeoutError at 500ms");
  const b = signature("t1", "TimeoutError at 500ms");
  assert.equal(a, b);
  assert.match(a, /^fs_[0-9a-f]{12}$/);
});

test("classifyAndRedact never returns raw text but detects PII", () => {
  const r = classifyAndRedact("t1", "borrower ssn 123-45-6789 not found", "AssertionError", policy);
  assert.equal(r.redact.containsPii, true);
  assert.ok(r.failureSignature?.startsWith("fs_"));
  assert.ok(!r.redact.normalized.includes("123-45-6789"));
});
