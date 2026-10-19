import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import PlatformAdmin from "./PlatformAdmin";

export const metadata = { title: `Platform Admin – ${PLATFORM_NAME}`, robots: { index: false } };

export default function PlatformAdminPage() {
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
      <PlatformAdmin rootDomain={rootDomain()} platformName={PLATFORM_NAME} />
    </main>
  );
}
