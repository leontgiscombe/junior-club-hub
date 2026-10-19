// The App Store app (ios-app/) adds this to its browser's user agent, so the
// site can tell it's inside the app. Inside it, nothing points to paying on the
// website (App Store guideline 3.1.1): clubs sign up in the app, and their
// admins subscribe with In-App Purchase (app/plans/AppPlans.tsx).
export const APP_USER_AGENT = "GrassrootsClubHubApp";

export const isAppUserAgent = (ua: string | null | undefined) => !!ua && ua.includes(APP_USER_AGENT);
