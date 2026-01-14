/**
 * Color Extraction Utility
 *
 * Client-side color palette extraction using Canvas API.
 * Uses k-means clustering to find dominant colors.
 */

import type { AspectRatio } from '@/hooks/backlot';

/**
 * Detect aspect ratio from image dimensions
 */
export function detectAspectRatio(width: number, height: number): AspectRatio {
  const ratio = width / height;
  if (ratio > 1.2) return 'landscape';
  if (ratio < 0.8) return 'portrait';
  return 'square';
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(c1: number[], c2: number[]): number {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

/**
 * Simple k-means clustering for color extraction
 */
function kMeans(pixels: number[][], k: number, maxIterations: number = 10): number[][] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  // Initialize centroids by picking evenly spaced pixels
  const step = Math.floor(pixels.length / k);
  let centroids = Array.from({ length: k }, (_, i) => [...pixels[i * step]]);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters: number[][][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }

      clusters[nearestIdx].push(pixel);
    }

    // Update centroids
    const newCentroids = clusters.map(cluster => {
      if (cluster.length === 0) return [0, 0, 0];
      const sum = cluster.reduce(
        (acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]],
        [0, 0, 0]
      );
      return [sum[0] / cluster.length, sum[1] / cluster.length, sum[2] / cluster.length];
    });

    // Check for convergence
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (colorDistance(centroids[i], newCentroids[i]) > 1) {
        converged = false;
        break;
      }
    }

    centroids = newCentroids;
    if (converged) break;
  }

  return centroids;
}

/**
 * Extract dominant colors from an image URL
 *
 * @param imageUrl - URL of the image to analyze
 * @param count - Number of colors to extract (default: 5)
 * @returns Promise resolving to array of hex color strings
 */
export async function extractColorPalette(imageUrl: string, count: number = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Create a small canvas for sampling (faster processing)
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels: number[][] = [];

        // Sample every few pixels for speed
        const sampleStep = 4;
        for (let i = 0; i < imageData.data.length; i += 4 * sampleStep) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip very light or very dark pixels (often backgrounds)
          const brightness = (r + g + b) / 3;
          if (brightness > 245 || brightness < 10) continue;

          pixels.push([r, g, b]);
        }

        if (pixels.length === 0) {
          resolve([]);
          return;
        }

        // Run k-means clustering
        const centroids = kMeans(pixels, count);

        // Sort by brightness (dark to light)
        centroids.sort((a, b) => {
          const brightnessA = a[0] + a[1] + a[2];
          const brightnessB = b[0] + b[1] + b[2];
          return brightnessA - brightnessB;
        });

        // Convert to hex
        const colors = centroids.map(c => rgbToHex(c[0], c[1], c[2]));
        resolve(colors);
      } catch (error) {
        console.warn('[ColorExtraction] Failed to extract colors:', error);
        resolve([]);
      }
    };

    img.onerror = () => {
      console.warn('[ColorExtraction] Failed to load image:', imageUrl);
      resolve([]);
    };

    // Handle CORS issues gracefully
    try {
      img.src = imageUrl;
    } catch {
      resolve([]);
    }
  });
}

/**
 * Extract colors and aspect ratio from an image URL
 */
export async function analyzeImage(imageUrl: string): Promise<{
  colorPalette: string[];
  aspectRatio: AspectRatio;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      const aspectRatio = detectAspectRatio(img.width, img.height);
      const colorPalette = await extractColorPalette(imageUrl);
      resolve({ colorPalette, aspectRatio });
    };

    img.onerror = () => {
      resolve({ colorPalette: [], aspectRatio: 'landscape' });
    };

    try {
      img.src = imageUrl;
    } catch {
      resolve({ colorPalette: [], aspectRatio: 'landscape' });
    }
  });
}

/**
 * Extract colors and aspect ratio from a File object
 */
export async function analyzeImageFile(file: File): Promise<{
  colorPalette: string[];
  aspectRatio: AspectRatio;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve({ colorPalette: [], aspectRatio: 'landscape' });
        return;
      }

      const result = await analyzeImage(dataUrl);
      resolve(result);
    };

    reader.onerror = () => {
      resolve({ colorPalette: [], aspectRatio: 'landscape' });
    };

    reader.readAsDataURL(file);
  });
}
