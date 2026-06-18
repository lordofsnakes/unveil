import Replicate from "replicate";

// Lazy singleton — never instantiate at module top-level in serverless.
let _client: Replicate | null = null;

export function getReplicate(): Replicate {
  if (!_client) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not set");
    }
    // useFileOutput: false → file outputs come back as plain URL strings
    // (not FileOutput stream objects), which is what the compositor fetches.
    _client = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
      useFileOutput: false,
    });
  }
  return _client;
}

// Verified live against the Replicate API on 2026-06-18 (versions pinned in env).
export const MODELS = {
  // Text-prompted bounding-box detection (video keyframes — P1).
  groundingDino: {
    ref: `adirik/grounding-dino:${process.env.REPLICATE_GROUNDING_DINO_VERSION}` as const,
  },
  // Combined detect + mask, single call (IMAGES only — P0).
  groundedSam: {
    ref: `schananas/grounded_sam:${process.env.REPLICATE_GROUNDED_SAM_VERSION}` as const,
  },
  // Video segmentation/tracking — P1. NOT an official model: it requires a
  // pinned version hash (calling by name returns 422/404). Verified 2026-06-18.
  sam2Video: {
    ref: `meta/sam-2-video:${process.env.REPLICATE_SAM2_VIDEO_VERSION}` as const,
  },
  // Motion-aware tracker (fallback for fast motion) — P1/P4.
  samurai: {
    ref: `zsxkib/samurai:${process.env.REPLICATE_SAMURAI_VERSION}` as const,
  },
} as const;

// Region prompt taxonomy — TUNE empirically (PRD open question #1).
// Comma-joined for grounded_sam's `mask_prompt` and grounding-dino's `query`.
export const DESIRED_REGIONS = ["breast", "genitalia", "buttocks", "nipple"];

// Regions we never want to blur, even if they overlap a positive match.
export const NEGATIVE_REGIONS = ["face", "clothing"];

// grounded_sam returns a 4-element iterator in a FIXED order. Verified against
// the model's default_example on 2026-06-18:
//   [0] annotated_picture_mask  [1] neg_annotated_picture_mask
//   [2] mask (clean B&W)        [3] inverted_mask
// We composite with [2] — NOT [0], which is the annotated overlay.
export const GROUNDED_SAM_OUTPUT = {
  annotated: 0,
  negAnnotated: 1,
  mask: 2,
  invertedMask: 3,
} as const;
