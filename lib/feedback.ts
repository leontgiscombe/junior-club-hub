// Help & Feedback: questions, problems and suggestions sent from the Support
// page (app/support) or the app, kept for the platform admin's inbox
// (app/platform/admin) and emailed to the platform's contact address. With
// where they were sent from, so a problem can be found. Server only.
import { randomUUID } from "crypto";
import { kvCall } from "./access";

export const FEEDBACK_KINDS = { question: "Question", problem: "Problem", idea: "Suggestion" } as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  name: string;
  email: string;
  /** the club's address it came from, "" on the platform's own */
  club: string;
  page: string;
  device: string;
  at: string;
  done?: boolean;
};

const KEY = "platform:feedback";
const MAX = 500;

export async function addFeedback(f: Omit<Feedback, "id" | "at">): Promise<Feedback> {
  const item: Feedback = { ...f, id: randomUUID(), at: new Date().toISOString() };
  await kvCall(["LPUSH", KEY, JSON.stringify(item)]);
  await kvCall(["LTRIM", KEY, 0, MAX - 1]);
  return item;
}

export async function listFeedback(): Promise<Feedback[]> {
  const raw = (await kvCall<string[] | null>(["LRANGE", KEY, 0, MAX - 1]).catch(() => null)) ?? [];
  return raw.flatMap((r) => {
    try {
      return [JSON.parse(r) as Feedback];
    } catch {
      return [];
    }
  });
}

/** Mark one done (or not), keeping its place in the list. */
export async function setFeedbackDone(id: string, done: boolean): Promise<boolean> {
  const all = await listFeedback();
  const i = all.findIndex((f) => f.id === id);
  if (i < 0) return false;
  await kvCall(["LSET", KEY, i, JSON.stringify({ ...all[i], done })]);
  return true;
}
