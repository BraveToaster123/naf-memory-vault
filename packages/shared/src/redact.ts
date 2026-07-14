import { compilePattern, getPolicy, type Policy } from "./policy.js";
import { normalizeError, signature } from "./signature.js";

export interface RedactResult {
  /** True if the input tripped a deny_pattern (PII). */
  containsPii: boolean;
  matchedPattern?: string;
  /** Normalized, truncated, PII-masked error text safe for signature hashing. */
  normalized: string;
}

export function containsPii(text: string, policy: Policy = getPolicy()): { hit: boolean; pattern?: string } {
  for (const p of policy.deny_patterns) {
    if (compilePattern(p).test(text)) return { hit: true, pattern: p };
  }
  return { hit: false };
}

/**
 * classifyAndRedact — turn a raw CI error string into safe, storable fields.
 * Never returns the raw text. Callers persist only `errorClass` + `signature`.
 */
export function classifyAndRedact(
  testId: string,
  errorMessage: string | undefined,
  errorClass: string | undefined,
  policy: Policy = getPolicy(),
): { errorClass?: string; failureSignature?: string; redact: RedactResult } {
  if (!errorMessage) {
    return { errorClass, failureSignature: undefined, redact: { containsPii: false, normalized: "" } };
  }
  const pii = containsPii(errorMessage, policy);
  const normalized = normalizeError(errorMessage);
  return {
    errorClass,
    failureSignature: signature(testId, errorMessage),
    redact: { containsPii: pii.hit, matchedPattern: pii.pattern, normalized },
  };
}
