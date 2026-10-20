// Home's cards a phone has hidden (app/components/HomeWidgets.tsx): their ids,
// dot-separated, in this cookie, so Home is drawn without them from the start.
export const HIDDEN_COOKIE = "hub_home_hidden";
export type WidgetId = "training" | "match" | "result" | "finances";

// "off" once a parent's tapped Not now on Home's card about setting up their
// child's own device (app/components/DevicePrompt.tsx), so it isn't drawn again
export const DEVICE_PROMPT_COOKIE = "hub_device_prompt";
