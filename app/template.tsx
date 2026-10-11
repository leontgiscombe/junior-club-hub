// Wraps each page and is drawn afresh on every move between pages, so each
// screen eases in like a phone app's (globals.css: .page-in). The tab bar is
// in the layout, outside this, so it stays put.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
