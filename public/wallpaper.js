(function () {
  if (document.getElementById("app-wallpaper")) return;
  const layer = document.createElement("div");
  layer.id = "app-wallpaper";
  layer.setAttribute("aria-hidden", "true");
  layer.hidden = true;
  const image = document.createElement("div");
  image.id = "app-wallpaper-image";
  const shade = document.createElement("div");
  shade.className = "hub-wallpaper-shade";
  layer.append(image, shade);
  document.body.prepend(layer);

  function readWallpaper() {
    let wall;
    try { wall = JSON.parse(localStorage.getItem("hub_wallpaper") || "null"); } catch {}
    let background = "";
    let filter = "";
    switch (wall && wall.kind) {
      case "club":
        background = "radial-gradient(120% 70% at 15% 0%, var(--color-green-500, #22c55e) 0%, transparent 60%), radial-gradient(90% 60% at 100% 30%, var(--club-bright, #3ee04f) 0%, transparent 55%), linear-gradient(180deg, var(--color-green-800, #166534), var(--club-night, #060906))";
        break;
      case "brush":
        background = "var(--club-night, #060906) url(/poster/brush-background.jpg) center top / cover no-repeat";
        filter = "var(--club-brush-filter, none)";
        break;
      case "pitch":
        background = "repeating-linear-gradient(180deg, #2f9a4c 0 56px, #23803c 56px 112px)";
        break;
      case "photo":
        if (typeof wall.photo === "string" && wall.photo) background = "#000 url(" + JSON.stringify(wall.photo) + ") center / cover no-repeat";
        break;
    }
    image.style.background = background;
    image.style.filter = filter;
    layer.hidden = !background;
    if (background) document.documentElement.dataset.wallpaper = wall.kind;
    else delete document.documentElement.dataset.wallpaper;
  }

  readWallpaper();
  window.addEventListener("storage", readWallpaper);
  window.addEventListener("hub-wallpaper", readWallpaper);
  window.addEventListener("pageshow", readWallpaper);
})();