import { notFound } from "next/navigation";
import AccountPreview from "./AccountPreview";

export const metadata = { title: "Account Preview", robots: { index: false, follow: false } };

export default function AccountPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AccountPreview />;
}