export type ParsedEdgeFunctionError = {
  error?: string;
  code?: string;
  [key: string]: unknown;
};

/**
 * Supabase function invoke errors often come through as:
 * "Edge function returned 400: Error, {\"error\":...,\"code\":...}"
 *
 * This helper extracts the embedded JSON (when present) to avoid losing `code`.
 */
export function parseEdgeFunctionErrorMessage(input: unknown): ParsedEdgeFunctionError {
  if (input == null) return {};

  if (typeof input === "object") {
    return input as ParsedEdgeFunctionError;
  }

  const message = String(input);

  // 1) Try direct JSON
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") return parsed as ParsedEdgeFunctionError;
  } catch {
    // ignore
  }

  // 2) Try extracting JSON substring
  const firstBrace = message.indexOf("{");
  const lastBrace = message.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = message.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed === "object") return parsed as ParsedEdgeFunctionError;
    } catch {
      // ignore
    }
  }

  return { error: message };
}
