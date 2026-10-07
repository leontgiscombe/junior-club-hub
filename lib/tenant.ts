// Which club the current request is for, from its web address. The rules are
// in lib/tenantHost.ts.
import { cache } from "react";
import { headers } from "next/headers";
import { tenantFromHost } from "./tenantHost";

export * from "./tenantHost";

/** The club this request is for (null on the platform's own site). */
export const getTenant = cache(async (): Promise<string | null> =>
  tenantFromHost((await headers()).get("host") ?? ""),
);

/** The club this request is for; throws on the platform's own site. */
export async function requireTenant(): Promise<string> {
  const tenant = await getTenant();
  if (!tenant) throw new Error("This page belongs to a club");
  return tenant;
}
