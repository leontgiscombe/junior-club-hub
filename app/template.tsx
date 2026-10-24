// Wraps each page, so each screen slides in like a phone app's: from the
// right going forward, from the left going back, and a cross-fade between the
// tab bar's tabs (components/PageTransition.tsx; globals.css, html[data-nav],
// set by public/app-feel.js). Where the browser can't, the page eases in
// instead (.page-in). The tab bar is in the layout, outside this, so it stays put.
import PageTransition from "./components/PageTransition";

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
