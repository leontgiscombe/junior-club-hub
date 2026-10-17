(function () {
  const views = ["learn", "practice", "progress"];
  function selectView(view) {
    if (!views.includes(view)) return;
    views.forEach((name) => {
      const tab = document.querySelector(`[data-hub-view="${name}"]`);
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
      const index = views.indexOf(tab.dataset.hubView);
      const next = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
      selectView(views[next]);
      document.querySelector(`[data-hub-view="${views[next]}"]`)?.focus();
    });
  });
  selectView("learn");
})();