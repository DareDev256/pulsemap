import { describe, it, expect } from "vitest";
import {
  safeParseJSON,
  safeJsonResponse,
  stripDangerousKeys,
} from "./validate";

// ── safeParseJSON ────────────────────────────────────────────────────────

describe("safeParseJSON", () => {
  it("parses valid JSON string", () => {
    const result = safeParseJSON<{ a: number }>('{"a":1}');
    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("returns error for non-string input (number)", () => {
    const result = safeParseJSON(42);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("expected string, got number");
  });

  it("returns error for non-string input (boolean)", () => {
    const result = safeParseJSON(true);
    expect(result.ok).toBe(false);
  });

  it("returns error for undefined", () => {
    const result = safeParseJSON(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("got undefined");
  });

  it("passes through object input without re-parsing", () => {
    const obj = { value: [1, 2, 3] };
    const result = safeParseJSON(obj);
    expect(result).toEqual({ ok: true, data: { value: [1, 2, 3] } });
  });

  it("passes through array input", () => {
    const result = safeParseJSON([1, 2]);
    expect(result).toEqual({ ok: true, data: [1, 2] });
  });

  it("returns error for null (non-string)", () => {
    const result = safeParseJSON(null);
    expect(result.ok).toBe(false);
  });

  it("returns error for empty string", () => {
    const result = safeParseJSON("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("empty string");
  });

  it("returns error for whitespace-only string", () => {
    const result = safeParseJSON("   ");
    expect(result.ok).toBe(false);
  });

  it("returns error for invalid JSON string", () => {
    const result = safeParseJSON("{broken", "WHO API");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("WHO API: invalid JSON");
  });

  it("handles JSON string primitives (number)", () => {
    const result = safeParseJSON<number>("42");
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("strips __proto__ from parsed JSON", () => {
    const result = safeParseJSON('{"__proto__":{"admin":true},"safe":"yes"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ safe: "yes" });
      expect(Object.prototype).not.toHaveProperty("admin");
    }
  });
});

// ── safeJsonResponse ─────────────────────────────────────────────────────

describe("safeJsonResponse", () => {
  function mockResponse(body: string, status = 200): Response {
    return new Response(body, { status });
  }

  it("parses valid JSON response", async () => {
    const res = mockResponse('{"value":[]}');
    const result = await safeJsonResponse<{ value: unknown[] }>(res);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.value).toEqual([]);
  });

  it("returns error for HTML error page", async () => {
    const res = mockResponse("<html>502 Bad Gateway</html>", 502);
    const result = await safeJsonResponse(res, "WHO API");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not valid JSON");
  });

  it("returns error for empty response body", async () => {
    const res = mockResponse("", 200);
    const result = await safeJsonResponse(res);
    expect(result.ok).toBe(false);
  });
});

// ── stripDangerousKeys ───────────────────────────────────────────────────

describe("stripDangerousKeys", () => {
  it("removes __proto__ at top level", () => {
    const input = { __proto__: { x: 1 }, safe: "ok" };
    // Object.entries won't see __proto__ set via literal in some engines,
    // so we use Object.defineProperty to force it
    const obj = Object.create(null);
    obj["__proto__"] = { x: 1 };
    obj["safe"] = "ok";
    expect(stripDangerousKeys(obj)).toEqual({ safe: "ok" });
  });

  it("removes constructor and prototype keys", () => {
    const obj = { constructor: "evil", prototype: {}, data: 1 };
    expect(stripDangerousKeys(obj)).toEqual({ data: 1 });
  });

  it("strips nested dangerous keys", () => {
    const obj = { level1: { __proto__: { admin: true }, name: "test" } };
    const result = stripDangerousKeys(obj) as Record<string, Record<string, unknown>>;
    expect(result.level1).toEqual({ name: "test" });
  });

  it("handles arrays with dangerous objects", () => {
    const arr = [{ __proto__: {}, ok: true }, { fine: true }];
    const result = stripDangerousKeys(arr);
    expect(result).toEqual([{ ok: true }, { fine: true }]);
  });

  it("caps recursion at depth 20", () => {
    // Build a 25-level deep object
    let obj: Record<string, unknown> = { leaf: "value" };
    for (let i = 0; i < 25; i++) {
      obj = { nested: obj };
    }
    // Should not throw — just stops stripping at depth 20
    expect(() => stripDangerousKeys(obj)).not.toThrow();
  });

  it("preserves Object.prototype integrity", () => {
    const malicious = '{"__proto__":{"polluted":true}}';
    safeParseJSON(malicious);
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
});
