/* Home page, loaded in <head>: marks the page as scripted so .rv sections start hidden and reveal on scroll (home.js).
   A safety timer reveals everything if home.js never runs. */
(function () {
  var d = document.documentElement; d.classList.add("js");
  setTimeout(function () { if (!window.SentinelHomeReady) d.classList.remove("js"); }, 2500);
})();
