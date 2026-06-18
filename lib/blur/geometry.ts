import type { DetectedRegion } from "@/lib/db/schema";

// CRITICAL: sam-2-video takes click POINTS [x,y], not boxes (PRD §13). Convert
// each detected box to its center point and emit the parallel arrays sam-2-video
// expects. Verified against the live model schema (2026-06-18):
//   click_coordinates: "[x,y],[x,y],..."   (determines the number of clicks)
//   click_frames:      "0,30,..."           (frame index per click)
//   click_labels:      "1,1,..."            (1 = foreground / include)
//   click_object_ids:  "breast_0,..."       (distinct id per tracked region)
export function regionsToSam2Clicks(regions: DetectedRegion[]) {
  const coords: string[] = [];
  const frames: number[] = [];
  const labels: number[] = [];
  const objectIds: string[] = [];

  regions.forEach((r, i) => {
    const [x1, y1, x2, y2] = r.box;
    const cx = Math.round((x1 + x2) / 2);
    const cy = Math.round((y1 + y2) / 2);
    coords.push(`[${cx},${cy}]`);
    frames.push(r.frame ?? 0);
    labels.push(1);
    objectIds.push(`${r.label}_${i}`);
  });

  return {
    click_coordinates: coords.join(","),
    click_frames: frames.join(","),
    click_labels: labels.join(","),
    click_object_ids: objectIds.join(","),
  };
}
