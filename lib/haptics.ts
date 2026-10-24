// A light tap felt in the hand when something important is done — saved,
// ticked, marked paid — as a phone app gives. public/app-feel.js does the
// work (it's on every page, the app's own and the two outside it). Browser-only.
export function haptic() {
  (window as unknown as { hubHaptic?: () => void }).hubHaptic?.();
}
