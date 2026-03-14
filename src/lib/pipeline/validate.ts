/**
 * Safe JSON parsing utilities for the pipeline layer.
 *
 * Every external data source (WHO API, request bodies) passes through here
 * before the rest of the pipeline touches it.  The goal is to turn any
 * malformed / non-string / non-object input into a typed parse-result instead
 * of letting JSON.parse or Response.json() throw uncontrolled exceptions.
 */

// ── types ────────────────────────────────────────────────────────────────

export type ParseOk<T> = { ok: true; data: T };
export type ParseErr = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

// ── safeParseJSON ────────────────────────────────────────────────────────

/**
 * Parse an unknown value as JSON with structural validation.
 *
 * Handles:
 *  - non-string inputs (numbers, booleans, objects, null, undefined)
 *  - invalid JSON strings
 *  - prototype-pollution keys (__proto__, constructor, prototype)
 *
 * @param input  The raw value (usually a string from an API response body)
 * @param label  Human-readable context for error messages
 */
export function safeParseJSON<T = unknown>(
  input: unknown,
  label = "JSON",
): ParseResult<T> {
  // Already an object/array — skip parsing, just sanitize
  if (input !== null && typeof input === "object") {
    return { ok: true, data: stripDangerousKeys(input) as T };
  }

  if (typeof input !== "string") {
    return {
      ok: false,
      error: `${label}: expected string, got ${typeof input}`,
    };
  }

  if (input.trim().length === 0) {
    return { ok: false, error: `${label}: empty string` };
  }

  try {
    const parsed = JSON.parse(input);
    if (parsed !== null && typeof parsed === "object") {
      return { ok: true, data: stripDangerousKeys(parsed) as T };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return {
      ok: false,
      error: `${label}: invalid JSON`,
    };
  }
}

// ── safeJsonResponse ─────────────────────────────────────────────────────

/**
 * Safely extract JSON from a fetch Response.
 *
 * Wraps `res.json()` (which throws SyntaxError on non-JSON bodies like
 * HTML error pages from CDN/proxy layers) and validates the result.
 */
export async function safeJsonResponse<T = unknown>(
  res: Response,
  label = "response",
): Promise<ParseResult<T>> {
  try {
    const body = await res.json();
    return safeParseJSON<T>(body, label);
  } catch {
    return {
      ok: false,
      error: `${label}: response body is not valid JSON (status ${res.status})`,
    };
  }
}

// ── prototype-pollution defense ──────────────────────────────────────────

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 20;

/**
 * Recursively strip prototype-pollution keys from parsed JSON.
 * Depth-capped to prevent stack overflow on adversarial input.
 */
export function stripDangerousKeys(obj: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => stripDangerousKeys(item, depth + 1));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    clean[key] = stripDangerousKeys(value, depth + 1);
  }
  return clean;
}
