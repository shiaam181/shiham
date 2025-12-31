import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let modelsLoading = false;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Load face-api.js models for face detection and recognition
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) {
    // Wait for models to finish loading
    while (modelsLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  modelsLoading = true;
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Face recognition models loaded successfully');
  } catch (error) {
    console.error('Failed to load face models:', error);
    throw new Error('Failed to load face recognition models');
  } finally {
    modelsLoading = false;
  }
}

/**
 * Detect a single face and extract its embedding (descriptor)
 * @param imageSource - HTMLImageElement, HTMLVideoElement, or HTMLCanvasElement
 * @returns Face embedding as number array, or null if no face detected
 */
export async function extractFaceEmbedding(
  imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<number[] | null> {
  await loadFaceModels();

  const detection = await faceapi
    .detectSingleFace(imageSource)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return null;
  }

  // Convert Float32Array to regular number array for JSON storage
  return Array.from(detection.descriptor);
}

/**
 * Calculate cosine similarity between two embeddings
 * @param embedding1 - First face embedding
 * @param embedding2 - Second face embedding
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Calculate Euclidean distance between two embeddings
 * @param embedding1 - First face embedding
 * @param embedding2 - Second face embedding
 * @returns Distance (lower = more similar, typically < 0.6 for same person)
 */
export function euclideanDistance(embedding1: number[], embedding2: number[]): number {
  return faceapi.euclideanDistance(embedding1, embedding2);
}

/**
 * Compare two face embeddings and determine if they match
 * @param storedEmbedding - The reference embedding from registration
 * @param capturedEmbedding - The newly captured embedding
 * @param threshold - Similarity threshold (default 0.6)
 * @returns Object with match result, confidence percentage, and reason
 */
export function compareFaceEmbeddings(
  storedEmbedding: number[],
  capturedEmbedding: number[],
  threshold: number = 0.6
): { match: boolean; confidence: number; reason: string } {
  // Use Euclidean distance for comparison (face-api.js standard)
  const distance = euclideanDistance(storedEmbedding, capturedEmbedding);
  
  // Convert distance to confidence percentage
  // Distance of 0 = 100% match, distance of 1 = 0% match
  // Typical same-person distance is < 0.6
  const confidence = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
  
  const match = distance < threshold;
  
  let reason: string;
  if (match) {
    if (confidence >= 90) {
      reason = 'Excellent match - faces are very similar';
    } else if (confidence >= 75) {
      reason = 'Good match - faces appear to be the same person';
    } else {
      reason = 'Match found within acceptable threshold';
    }
  } else {
    reason = 'Face does not match the registered reference';
  }

  return { match, confidence, reason };
}

/**
 * Check if face models are currently loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}
