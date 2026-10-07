import Link from "next/link";
import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import PlatformAdmin from "./PlatformAdmin";

export const metadata = { title: `Platform Admin – ${PLATFORM_NAME}`, robots: { index: false } };

export default function PlatformAdminPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-green-700">
          ← {PLATFORM_NAME}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-gray-900">Platform Admin</h1>
        <p className="mt-1 text-gray-500">Every club on {PLATFORM_NAME}.</p>
        <PlatformAdmin rootDomain={rootDomain()} />
      </div>
    </main>
  );
}
