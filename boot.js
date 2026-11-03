/* Sets the colour theme before the page paints, so a dark-mode user never sees a white flash. */
(function () {
  try {
    var ui = JSON.parse(localStorage.getItem("hjcc-force-tracker-ui-v1") || "{}");
    if (ui.theme === "light" || ui.theme === "dark") document.documentElement.setAttribute("data-theme", ui.theme);
  } catch (e) { /* storage blocked: follow the system theme */ }
})();
