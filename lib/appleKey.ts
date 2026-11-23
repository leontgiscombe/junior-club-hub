// Reading an Apple private key (a .p8 file's text) from a setting however it
// was pasted: with its line breaks, with them lost (all on one line, or with
// spaces instead — easy to do copying from an iPhone), with "\n" typed in, in
// quotes, or without its BEGIN and END lines at all. The key itself is the
// letters between them, so those are taken out and read directly. Server only.
import { createPrivateKey, type KeyObject } from "crypto";

export function readAppleKey(text: string): KeyObject {
  const body = text
    .replace(/\\n/g, "\n")
    // the BEGIN / END lines, whatever dashes they came with
    .replace(/[-–—]+\s*(BEGIN|END)[A-Z ]*KEY\s*[-–—]+/gi, "")
    // anything that isn't part of the key: spaces, line breaks, quotes
    .replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) throw new Error("The key is empty");
  return createPrivateKey({ key: Buffer.from(body, "base64"), format: "der", type: "pkcs8" });
}
