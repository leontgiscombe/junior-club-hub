import { notFound } from "next/navigation";
import StatsPreview from "./StatsPreview";

export const metadata = { title: "Stats Tracker Preview", robots: { index: false, follow: false } };

export default function StatsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StatsPreview />;
}