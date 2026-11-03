"use strict";
/* Default battle lines, one fixed date per line, [lat, lon] from one end to the other. Each end is anchored on a coast,
   a border or a neutral country so the lines meet the map consistently. Simplified: these are references, not surveys. */
module.exports = {
  t1: [
    { id: "t1-north", name: "Anglo-Burgundian front, 1429",
      pts: [[48.64, -1.51], [48.60, -0.90], [48.43, -0.09], [48.20, 0.10], [47.99, 0.20], [47.95, 1.00], [47.90, 1.91], [47.80, 2.90], [47.80, 3.57], [47.45, 3.95], [47.00, 4.35], [46.60, 4.55], [46.25, 4.85], [46.10, 5.55]] },
    { id: "t1-gascony", name: "Guyenne front, 1429",
      pts: [[45.62, -1.04], [45.50, -0.40], [45.20, 0.20], [45.00, 0.60], [44.65, 0.60], [44.25, 0.20], [43.90, -0.20], [43.60, -0.45], [43.35, -0.90], [43.30, -1.50]] }
  ],
  t2: [] /* no battle lines for the First World War */
};
