// The coaches who may hold the video camera, in alphabetical order. Edit this
// list to add or remove people; the "who has the camera" dropdown follows.
export const CAMERA_HOLDERS = [
  "Ashton",
  "Chris",
  "Craig",
  "Dan",
  "Daz",
  "Leon",
  "Liam",
  "Rob",
] as const;

export function isValidHolder(name: string): boolean {
  return (CAMERA_HOLDERS as readonly string[]).includes(name);
}
