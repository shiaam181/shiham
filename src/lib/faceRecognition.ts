import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let modelsLoading = false;
let modelsLoadPromise: Promise<void> | null = null;
let modelsLoadError: Error | null = null;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MODEL_LOAD_TIMEOUT_MS = 30000; // 30 second timeout

/**
 * Check if WebGL is supported by the device
 */
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Load face-api.js models for face detection and recognition
 * With timeout and WebGL fallback for older devices
 */
export async function loadFaceModels(): Promise<void> {
  // Already loaded successfully
  if (modelsLoaded) return;
  
  // Previous load failed - throw the cached error
  if (modelsLoadError) {
    throw modelsLoadError;
  }
  
  // Another load is in progress - wait for it
  if (modelsLoading && modelsLoadPromise) {
    return modelsLoadPromise;
  }

  // Check WebGL support before attempting to load
  if (!isWebGLSupported()) {
    const error = new Error('WebGL not supported on this device. Face recognition requires a newer browser.');
    modelsLoadError = error;
    console.warn('WebGL not supported - face recognition disabled');
    throw error;
  }

  modelsLoading = true;
  
  modelsLoadPromise = new Promise<void>(async (resolve, reject) => {
    // Set a timeout to prevent infinite hangs on problematic devices
    const timeoutId = setTimeout(() => {
      modelsLoading = false;
      const error = new Error('Face model loading timed out. Please try again or use a different device.');
      modelsLoadError = error;
      reject(error);
    }, MODEL_LOAD_TIMEOUT_MS);
    
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      
      clearTimeout(timeoutId);
      modelsLoaded = true;
      modelsLoading = false;
      console.log('Face recognition models loaded successfully');
      resolve();
    } catch (error: any) {
      clearTimeout(timeoutId);
      modelsLoading = false;
      const loadError = new Error(`Failed to load face recognition models: ${error.message || 'Unknown error'}`);
      modelsLoadError = loadError;
      console.error('Failed to load face models:', error);
      reject(loadError);
    }
  });
  
  return modelsLoadPromise;
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
 * Uses cosine similarity (more stable across lighting/pose than raw distance scaling).
 *
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
  const similarity = cosineSimilarity(storedEmbedding, capturedEmbedding);
  const confidence = Math.max(0, Math.min(100, Math.round(similarity * 100)));

  const match = similarity >= threshold;

  let reason: string;
  if (match) {
    if (confidence >= 90) reason = 'Excellent match';
    else if (confidence >= 75) reason = 'Good match';
    else reason = 'Match within threshold';
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
