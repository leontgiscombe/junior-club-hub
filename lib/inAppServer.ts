// Whether this request comes from inside the App Store app (lib/inApp.ts). Server only.
import { headers } from "next/headers";
import { isAppUserAgent } from "./inApp";

export async function inApp(): Promise<boolean> {
  return isAppUserAgent((await headers()).get("user-agent"));
}
