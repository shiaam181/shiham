import type { Json } from "@/integrations/supabase/types";

/**
 * Face embedding can be stored as:
 * - an object (Face++ metadata)
 * - an array (legacy/vector)
 *
 * This helper prevents redirect loops caused by assuming it's always an array.
 */
export function hasFaceEmbedding(faceEmbedding: Json | null | undefined): boolean {
  if (faceEmbedding == null) return false;
  if (Array.isArray(faceEmbedding)) return faceEmbedding.length > 0;
  if (typeof faceEmbedding === "object") {
    return Object.keys(faceEmbedding as Record<string, unknown>).length > 0;
  }
  // string/number/boolean (unexpected, but treat as present)
  return true;
}
