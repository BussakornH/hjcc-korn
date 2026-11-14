/* Home page: reveal sections as they scroll in, and the UTC clock. */
(function () {
  window.SentinelHomeReady = true;
  var els = document.querySelectorAll(".rv");
  if (!("IntersectionObserver" in window)) { for (var i = 0; i < els.length; i++) els[i].classList.add("in"); }
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .12 });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }
  var s = document.getElementById("stamp");
  function t() { s.textContent = "UTC " + new Date().toISOString().slice(11, 19); } t(); setInterval(t, 1000);
})();
