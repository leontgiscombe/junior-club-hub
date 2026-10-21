import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import SignupForm from "./SignupForm";
import BackArrow from "./BackArrow";
import { inApp } from "@/lib/inAppServer";

export const metadata = { title: `Start Your Club – ${PLATFORM_NAME}` };

export default async function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">
        {/* back, as a round button like the app's other screens, clear of the phone's status bar: a step back while signing up */}
        <BackArrow label={`Back to ${PLATFORM_NAME}`} />
        <h1 className="mt-5 text-3xl font-extrabold text-gray-900">Start Your Club</h1>
        <p className="mt-1 text-gray-500">Your club&apos;s own hub, ready in a minute.</p>
        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <SignupForm rootDomain={rootDomain() || "your-domain"} appView={await inApp()} />
        </div>
      </div>
    </main>
  );
}
