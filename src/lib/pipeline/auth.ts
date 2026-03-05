import { NextRequest, NextResponse } from "next/server";

/**
 * Fail-closed authentication for pipeline API routes.
 *
 * Returns null when auth succeeds, or a NextResponse 401/503 when it fails.
 * Unlike a fail-open check (skip if secret is missing), this REJECTS all
 * requests when CRON_SECRET is not configured — preventing accidental
 * public exposure of data-mutation endpoints.
 */
export function validatePipelineAuth(
  request: NextRequest
): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: if the secret isn't configured, reject everything.
  // This prevents accidental public access when env vars are missing.
  if (!cronSecret) {
    console.error(
      "[Auth] CRON_SECRET is not configured — rejecting request. " +
        "Set CRON_SECRET in your environment variables."
    );
    return NextResponse.json(
      { error: "Service unavailable — authentication not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");

  // Constant-time-ish comparison to mitigate timing attacks.
  // Node's timingSafeEqual requires equal-length buffers, so we
  // first check length, then compare byte-by-byte.
  const expected = `Bearer ${cronSecret}`;
  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeCompare(authHeader, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Auth passed
}

/**
 * Constant-time string comparison to prevent timing-based token extraction.
 * Assumes both strings are the same length (caller must check first).
 */
function timingSafeCompare(a: string, b: string): boolean {
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Sanitize an error for client-facing responses.
 * Strips stack traces and internal paths — returns only a generic message
 * unless the error is a known, safe-to-expose validation message.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only expose messages from fetch failures (WHO API status codes)
    if (error.message.startsWith("WHO API returned")) {
      return error.message;
    }
    // Timeout errors are safe to expose
    if (error.name === "AbortError") {
      return "Upstream API request timed out";
    }
  }
  return "Internal pipeline error";
}
