// Who runs the platform, for the privacy policy and terms (app/privacy,
// app/terms). Set PLATFORM_OPERATOR to the person or business legally
// responsible (e.g. "Jane Smith trading as Grassroots Club Hub") and
// PLATFORM_CONTACT_EMAIL to where questions should go (hello@…).
import { PLATFORM_NAME, rootDomain } from "./tenantHost";

export const LEGAL_UPDATED = "7 October 2026";

export function operator() {
  const root = rootDomain().replace(/:\d+$/, "");
  return {
    name: process.env.PLATFORM_OPERATOR || `the team behind ${PLATFORM_NAME}`,
    email: process.env.PLATFORM_CONTACT_EMAIL || (root ? `hello@${root}` : ""),
  };
}
