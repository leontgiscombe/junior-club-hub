import { notFound } from "next/navigation";
import TrainingPreview from "./TrainingPreview";

export const metadata = { title: "Training Hub Preview", robots: { index: false, follow: false } };

export default function TrainingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TrainingPreview />;
}