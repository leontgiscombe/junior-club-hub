// Put on a sign-in screen to keep the tab bar off it (globals.css hides the
// bar while one of these is on the page). Draws nothing.
export default function NoTabBar() {
  return <span hidden className="no-tabbar" />;
}
