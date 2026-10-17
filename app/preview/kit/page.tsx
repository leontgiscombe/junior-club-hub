import { notFound } from "next/navigation";
import KitPreview from "./KitPreview";
import ParentKit from "../../components/ParentKit";

export const metadata = { title: "Kit Preview", robots: { index: false, follow: false } };

export default async function KitPreviewPage({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  if ((await searchParams).live === "1") return <ParentKit />;
  return <KitPreview />;
}