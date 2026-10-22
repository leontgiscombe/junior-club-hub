(function () {
  // "next" (Up Next) only shows for a team's own players and families (index.html showUpNext)
  const views = ["learn", "practice", "progress", "next"];
  const tabOf = (name) => document.querySelector(`[data-hub-view="${name}"]`);
  const shown = () => views.filter((name) => tabOf(name) && !tabOf(name).hidden);
  function selectView(view) {
    if (!shown().includes(view)) return;
    views.forEach((name) => {
      const tab = tabOf(name);
      const panel = document.getElementById(`hub-${name}`);
      if (tab) {
        tab.setAttribute("aria-selected", String(name === view));
        tab.tabIndex = name === view ? 0 : -1;
      }
      if (panel) panel.hidden = name !== view;
    });
    if (view === "progress" && typeof window.refreshHomeProgress === "function") window.refreshHomeProgress();
    window.scrollTo(0, 0);
  }
  window.setHubHomeView = selectView;
  document.querySelectorAll("[data-hub-view]").forEach((tab) => {
    tab.addEventListener("click", () => selectView(tab.dataset.hubView));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const order = shown();
      const index = order.indexOf(tab.dataset.hubView);
      const next = event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + order.length) % order.length;
      selectView(order[next]);
      tabOf(order[next])?.focus();
    });
  });
  selectView("learn");
})();