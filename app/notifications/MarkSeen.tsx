"use client";

// Opening Notifications: everything here has been seen, so the bell's red
// number goes (NotificationBell). What was new stays highlighted on this
// visit, as the page was drawn before this. Draws nothing.
import { useEffect } from "react";
import { INBOX_SEEN_EVENT } from "../components/NotificationBell";

export default function MarkSeen() {
  useEffect(() => {
    window.dispatchEvent(new Event(INBOX_SEEN_EVENT));
    fetch("/api/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "seen" }) }).catch(() => {});
  }, []);
  return null;
}
