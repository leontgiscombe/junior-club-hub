import Link from "next/link";
import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import SignupForm from "./SignupForm";

export const metadata = { title: `Start Your Club – ${PLATFORM_NAME}` };

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-green-700">
          ← {PLATFORM_NAME}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-gray-900">Start Your Club</h1>
        <p className="mt-1 text-gray-500">Your club&apos;s own hub, ready in a minute.</p>
        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <SignupForm rootDomain={rootDomain() || "your-domain"} />
        </div>
      </div>
    </main>
  );
}
