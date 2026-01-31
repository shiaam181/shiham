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

/**
 * New (current) face registration format: AWS Rekognition metadata.
 *
 * Legacy formats (Face API vectors, Face++ metadata) should NOT be treated as valid
 * for AWS-based attendance verification.
 */
export function getAwsRekognitionCollectionId(
  faceEmbedding: Json | null | undefined
): string | null {
  if (faceEmbedding == null) return null;
  if (Array.isArray(faceEmbedding)) return null;
  if (typeof faceEmbedding !== "object") return null;

  const obj = faceEmbedding as Record<string, unknown>;
  const provider = obj["provider"];
  const collectionId = obj["collection_id"];

  if (provider !== "aws_rekognition") return null;
  if (typeof collectionId !== "string" || collectionId.trim().length === 0) return null;

  return collectionId;
}

export function hasAwsRekognitionRegistration(
  faceEmbedding: Json | null | undefined
): boolean {
  return getAwsRekognitionCollectionId(faceEmbedding) != null;
}
