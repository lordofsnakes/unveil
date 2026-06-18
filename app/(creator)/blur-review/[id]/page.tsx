import { notFound } from "next/navigation";
import { getJob } from "@/lib/blur/jobs";
import { presignPrivateGet } from "@/lib/blob";
import { ReviewPanel } from "@/components/blur/ReviewPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always reflect current job state

export default async function BlurReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  // Server owns the gate: presign the (private) blurred derivative for preview.
  const previewUrl = job.blurredBlobUrl
    ? await presignPrivateGet(job.blurredBlobUrl, 300)
    : null;

  return (
    <ReviewPanel
      jobId={job.id}
      status={job.status}
      mediaType={job.mediaType}
      previewUrl={previewUrl}
      regions={job.regions ?? []}
      confidence={job.detectionConfidence}
    />
  );
}
