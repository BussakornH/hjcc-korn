/* HJCC Force Tracker: the two committee topics, their classes and sub classes, and the demo forces.

   Classification: Class (Army, Navy, Airforce, Marine) -> Sub class (e.g. Army: Infantry, Light Infantry ...).
   EVERY STAT HERE IS A PLACEHOLDER until the allocations and the chairs' military booklet arrive.
   They only fill in Attack / HP / Movement / Range when a unit is added; edit them on My Forces or Rules & Formulas.
   Sub class rows: [code, name, class, ATK, HP, MOV, RNG]. The committee has one front, so there is one front column. */
(function () {
  var CLASSES = [
    { id: "army", name: "Army", color: "#6b7a2a" },
    { id: "navy", name: "Navy", color: "#4f5bd5" },
    { id: "air", name: "Airforce", color: "#0089a3" },
    { id: "marine", name: "Marine", color: "#c96a00" }
  ];
  /* each topic keeps only the classes that existed in its period: no Airforce or Marine in 1337 (there was no air power, and marines as a separate service came much later) */
  var classes = function (ids) { return copy(CLASSES.filter(function (c) { return ids.indexOf(c.id) >= 0; })); };
  /* the foot soldiers every period has, shared by both topics */
  var ARMY = [
    ["INF", "Infantry", "army", 5, 7, 5, 0],
    ["L-INF", "Light Infantry", "army", 4, 4, 5, 0],
    ["H-INF", "Heavy Infantry", "army", 6, 13, 6, 0]
  ];
  var copy = function (a) { return a.map(function (x) { return Object.assign({}, x); }); };
  window.HJCC_TOPICS = {
    t1: {
      id: "t1", num: 1, title: "The Hundred Years' War", year: "1337",
      branches: classes(["army", "navy"]),
      types: ARMY.concat([
        ["XBW", "Crossbowmen", "army", 5, 3, 3, 2],
        ["HOB", "Hobelars", "army", 4, 4, 8, 0],
        ["CAV", "Cavalry", "army", 6, 4, 7, 0],
        ["ARC", "Archers", "army", 4, 3, 4, 2],
        ["SIE", "Siege Engine", "army", 7, 4, 1, 3],
        ["GAL", "War Galley", "navy", 6, 5, 7, 0],
        ["COG", "Cog", "navy", 4, 8, 6, 0]
      ]),
      fronts: ["Front line"],
      suggest: ["Kingdom of England", "Kingdom of France", "Duchy of Burgundy", "Duchy of Brittany", "Kingdom of Scotland", "Crown of Castile", "County of Flanders", "Holy See"],
      /* demo: [code, how many, column] (0 = Reserve, 1 = Front line); fights: [attacking side, column, attackers, defenders] */
      sample: {
        me: [["INF", 3, 1], ["INF", 1, 0], ["L-INF", 2, 1], ["H-INF", 2, 1], ["HOB", 1, 0], ["CAV", 2, 1], ["ARC", 3, 1], ["XBW", 2, 1], ["SIE", 1, 1], ["GAL", 1, 1], ["COG", 2, 0]],
        foe: [["INF", 4, 1], ["H-INF", 2, 1], ["CAV", 3, 1], ["ARC", 2, 1], ["XBW", 2, 1], ["L-INF", 2, 0], ["GAL", 2, 1]],
        fights: [["me", 1, 3, 2], ["foe", 1, 3, 2], ["me", 1, 2, 1], ["foe", 1, 2, 2], ["me", 1, 2, 2]]
      }
    },
    t2: {
      id: "t2", num: 2, title: "The First World War", year: "1914",
      branches: classes(["army", "navy", "air", "marine"]),
      types: ARMY.concat([
        ["M-INF", "Mechanized Infantry", "army", 7, 9, 7, 0],
        ["SF", "Special Force", "army", 8, 11, 7, 0],
        ["CAV", "Cavalry", "army", 4, 6, 8, 0],
        ["ART", "Artillery", "army", 7, 4, 2, 3],
        ["ENG", "Engineers", "army", 2, 6, 4, 0],
        ["DES", "Destroyer", "navy", 8, 9, 13, 0],
        ["CRU", "Cruiser", "navy", 7, 9, 9, 2],
        ["DRD", "Dreadnought", "navy", 10, 14, 6, 3],
        ["SUB", "Submarine", "navy", 8, 4, 7, 0],
        ["FTR", "Fighter", "air", 5, 3, 10, 0],
        ["REC", "Reconnaissance", "air", 1, 3, 12, 0],
        ["BMB", "Bomber", "air", 9, 5, 8, 0],
        ["MAR", "Marine Infantry", "marine", 6, 7, 7, 0],
        ["NLF", "Naval Landing Force", "marine", 5, 6, 6, 0]
      ]),
      fronts: ["Front line"],
      suggest: ["British Empire", "French Republic", "Russian Empire", "German Empire", "Austria-Hungary", "Ottoman Empire", "Kingdom of Italy", "Kingdom of Serbia", "Kingdom of Belgium", "Empire of Japan", "United States"],
      sample: {
        me: [["INF", 4, 1], ["L-INF", 2, 1], ["H-INF", 2, 1], ["M-INF", 2, 1], ["SF", 1, 0], ["ART", 2, 1], ["DES", 2, 1], ["CRU", 1, 1], ["DRD", 1, 0], ["SUB", 1, 1], ["FTR", 2, 1], ["REC", 1, 0], ["MAR", 5, 1], ["NLF", 1, 0]],
        foe: [["INF", 5, 1], ["H-INF", 2, 1], ["ART", 2, 1], ["CAV", 1, 1], ["DRD", 2, 1], ["SUB", 2, 1], ["BMB", 1, 1]],
        fights: [["me", 1, 4, 3], ["foe", 1, 4, 3], ["me", 1, 3, 2], ["foe", 1, 3, 2], ["me", 1, 3, 2]]
      }
    }
  };
})();
