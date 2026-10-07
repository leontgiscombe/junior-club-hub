// The "reset your coach password" email, sent when a club asks for one or
// when the platform's admin sends one. Server only.
import { sendEmail, simpleEmail } from "./email";
import { getClubFor } from "./settings";
import { PLATFORM_NAME, tenantUrl } from "./tenant";
import { createResetToken, type TenantRecord } from "./tenants";

/** Email the club a one-hour, single-use link to choose a new coach password. */
export async function sendResetEmail(record: TenantRecord): Promise<boolean> {
  const token = await createResetToken(record.id);
  const club = await getClubFor(record.id);
  const link = tenantUrl(record.id, `/reset-password?token=${encodeURIComponent(token)}`);
  return sendEmail({
    to: record.email,
    subject: `Reset the ${club.name} coach password`,
    ...simpleEmail({
      heading: "Reset your coach password",
      paragraphs: [
        `Someone asked to reset the coach password for ${club.name} on ${PLATFORM_NAME}.`,
        "Tap the button to choose a new one. The link works once, for the next hour.",
        "If it wasn't you, ignore this email and the password stays as it is.",
      ],
      button: { label: "Choose a New Password", url: link },
      footer: `${PLATFORM_NAME} · ${tenantUrl(record.id)}`,
    }),
  });
}
