import { notFound } from "next/navigation";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";
import ResetPassword from "./ResetPassword";

export async function generateMetadata() {
  const CLUB = await getClub();
  return { title: `Reset the Coach Password – ${CLUB.name}` };
}

export default async function ResetPasswordPage() {
  // a single-club hub's password is ADMIN_KEY, set where it's hosted
  if ((await getTenant()) === DEFAULT_TENANT) notFound();
  return <ResetPassword />;
}
