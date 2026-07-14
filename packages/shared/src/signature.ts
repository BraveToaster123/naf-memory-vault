import { createHash } from "node:crypto";

/**
 * Normalize an error message so it can be hashed into a stable signature
 * without leaking PII or volatile values. Mirrors doc 03 normalizeError.
 */
export function normalizeError(msg: string): string {
  return msg
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{10,}\b/g, "[NUM]")
    .replace(/https?:\/\/\S+/g, "[URL]")
    .replace(/0x[0-9a-fA-F]+/g, "[HEX]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable 16-char failure signature keyed on test + normalized error. */
export function signature(testId: string, error: string): string {
  return "fs_" + sha256(`${testId}:${normalizeError(error)}`).slice(0, 12);
}
