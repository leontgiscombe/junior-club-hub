// The visitor's IP address, for counting attempts (sign-ins, sign-ups, club
// lookups). Render sits behind Cloudflare, which sets cf-connecting-ip itself,
// so it can't be faked; x-forwarded-for is the fallback (e.g. running locally).
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown"
  );
}
