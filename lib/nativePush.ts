// Alerts in the App Store app (ios-app/): its PushNotifications plugin, used
// through the Capacitor bridge the app puts on every page (there's no
// @capacitor/core in the site). A build of the app without the plugin, or a
// browser, has none of this: nativePush() is false. Client only.

type Bridge = {
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<Record<string, unknown>>;
  nativeCallback?: (plugin: string, method: string, options: object, cb: (data: Record<string, unknown> | null) => void) => string;
};

const bridge = (): Bridge | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: Bridge }).Capacitor;

const PLUGIN = "PushNotifications";
const TOKEN_KEY = "hub_apns_token";

/** Whether this is the App Store app with native alerts. */
export const nativePush = () => {
  const b = bridge();
  return !!b?.PluginHeaders?.some((h) => h.name === PLUGIN) && typeof b.nativePromise === "function";
};

/** This phone's token from last time (kept per club). */
export function savedToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Ask to show alerts, then this phone's token from Apple. */
export async function nativeToken(): Promise<string> {
  const b = bridge()!;
  const perm = await b.nativePromise!(PLUGIN, "requestPermissions", {});
  if (perm?.receive !== "granted") {
    throw new Error("Alerts are off for Club Hub. Turn them on in your phone's Settings → Club Hub → Notifications, then try again.");
  }
  const token = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The phone didn't answer — try again")), 15_000);
    b.nativeCallback!(PLUGIN, "addListener", { eventName: "registration" }, (d) => {
      clearTimeout(timer);
      resolve(String(d?.value ?? ""));
    });
    b.nativeCallback!(PLUGIN, "addListener", { eventName: "registrationError" }, (d) => {
      clearTimeout(timer);
      reject(new Error(String(d?.error ?? "Couldn't set up alerts")));
    });
    b.nativePromise!(PLUGIN, "register", {}).catch(reject);
  });
  if (!token) throw new Error("Couldn't set up alerts");
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  return token;
}

/** Calls `open` with the page a tapped alert is for. Returns a function to stop listening. */
export function onAlertTapped(open: (url: string) => void): () => void {
  const b = bridge();
  if (!nativePush() || typeof b?.nativeCallback !== "function") return () => {};
  const id = b.nativeCallback(PLUGIN, "addListener", { eventName: "pushNotificationActionPerformed" }, (d) => {
    const url = (d?.notification as { data?: { url?: unknown } } | undefined)?.data?.url;
    if (typeof url === "string" && url.startsWith("https://")) open(url);
  });
  return () => {
    b.nativePromise!(PLUGIN, "removeListener", { callbackId: id, eventName: "pushNotificationActionPerformed" }).catch(() => {});
  };
}
