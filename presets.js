/* HJCC Force Tracker: the two committee topics, their classes and sub classes, and the demo forces.

   Classification: Class (Army, Navy, Airforce, Marine) -> Sub class (e.g. Army: Infantry, Light Infantry ...).
   Topic 1's stats are still placeholders. Topic 2 (1914) follows the chairs' Military Resources Booklet: its 11 recruitable units and their
   base stats (A / D / M), mapped onto ATK / HP / MOV. The booklet's Mo (unit morale) has no field in the tracker: morale is kept per side.
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
      /* the booklet has only Army and Navy units: no Airforce or Marine in the 1914 topic */
      branches: classes(["army", "navy"]),
      /* [code, name, class, ATK (A), HP (the booklet's D), MOV (M), RNG]. The booklet gives no range figure: the Heavy Siege Artillery,
         Dreadnought and Cruiser keep the range the tracker already had for their kind ("increased range accounted for") */
      types: [
        ["INF", "Trench Infantry", "army", 5, 5, 5, 0],
        ["MP", "Military Police", "army", 3, 3, 2, 0],
        ["L-INF", "Light Chasseurs", "army", 4, 4, 7, 0],
        ["H-INF", "Machine Gun Corps", "army", 6, 7, 3, 0],
        ["CAV", "Cavalry", "army", 6, 2, 10, 0],
        ["ARM", "Armored Tanks", "army", 10, 1, 9, 0],
        ["SAP", "Heavy Siege Artillery", "army", 5, 5, 5, 3],
        ["SF", "Special Forces", "army", 8, 8, 7, 0],
        ["SUB", "U-Boats / Submarines", "navy", 7, 3, 8, 0],
        ["BAT", "Dreadnought Battleships", "navy", 10, 10, 3, 3],
        ["CRU", "Cruisers", "navy", 7, 7, 8, 2]
      ],
      fronts: ["Front line"],
      suggest: ["British Empire", "French Republic", "Russian Empire", "German Empire", "Austria-Hungary", "Ottoman Empire", "Kingdom of Italy", "Kingdom of Serbia", "Kingdom of Belgium", "Kingdom of the Netherlands", "Empire of Japan", "United States"],
      sample: {
        me: [["INF", 4, 1], ["L-INF", 2, 1], ["H-INF", 2, 1], ["CAV", 1, 0], ["ARM", 1, 1], ["SAP", 2, 1], ["SF", 1, 0], ["BAT", 1, 0], ["CRU", 1, 1], ["SUB", 1, 1], ["MP", 1, 0]],
        foe: [["INF", 4, 1], ["L-INF", 1, 1], ["H-INF", 1, 1], ["CAV", 1, 1], ["SAP", 1, 1], ["SF", 1, 0], ["BAT", 2, 1], ["CRU", 1, 1], ["SUB", 1, 1], ["MP", 1, 0]],
        fights: [["me", 1, 4, 3], ["foe", 1, 4, 3], ["me", 1, 3, 2], ["foe", 1, 3, 2], ["me", 1, 3, 2]]
      },
      /* the chairs' order of battle for a country, keyed by the delegate's character exactly as api/_chars.js spells it.
         units: [class code, unit name, strength %] in the booklet's order; a unit the booklet lists as "Not Found" (0%) is not raised yet and is left out.
         The booklet caps each country at 21 units. */
      booklets: {
        "Queen Wilhema (Netherlands)": { country: "Netherlands", units: [
          ["INF", "1st Field Army Border Defense Division", 100],
          ["L-INF", "2nd Royal Guards Grenadiers & Jagers", 80],
          ["SAP", "3rd New Dutch Waterline Heavy Artillery Battery", 0],
          ["MP", "4th Royal Marechaussee Military Police Corps", 50],
          ["CAV", "5th Royal Mounted Hussar Reconnaissance Unit", 0],
          ["BAT", "HNLMS De Zeven Provinci\u00ebn Coastal Defense Ship", 0],
          ["CRU", "North Sea Mine-Laying & Torpedo Escort Division", 40],
          ["SUB", "1st Coastal Neutrality Submarine Patrol", 0]
        ] },
        "Emperor Franz Joseph I (Austria-Hungary)": { country: "Austria-Hungary", units: [
          ["INF", "1st Vienna Common Army Infantry Division", 100],
          ["INF", "2nd Tyrolean Kaiserj\u00e4ger Alpine Regiment", 80],
          ["L-INF", "3rd Bosnian-Herzegovinian Infantry Battalion", 100],
          ["SAP", "4th Skoda 305mm Heavy Siege Howitzer Battery", 100],
          ["H-INF", "5th Isonzo Front Fortress Machine Gun Corps", 0],
          ["SF", "9th K.u.K Jagdkommando Special Assault Battalion", 40],
          ["INF", "10th Galician Border Defense Regiment", 80],
          ["BAT", "SMS Viribus Unitis Battleship Flagship", 0],
          ["BAT", "1st Tegetthoff Class Dreadnought Division", 40],
          ["SUB", "K.u.K Adriatic U-Boat Flotilla (Pula)", 0],
          ["CRU", "SMS Novara Armored Cruiser Detachment", 30]
        ] },
        "Istvan Tisza (Austria-Hungary)": { country: "Austria-Hungary (Hungarian command)", units: [
          ["CAV", "6th Royal Hungarian Honv\u00e9d Mounted Hussars", 0],
          ["INF", "7th Royal Hungarian Landwehr Infantry Brigade", 100],
          ["MP", "8th Hungarian Territorial Defense Guard Corps", 70]
        ] }
      }
    }
  };
})();
