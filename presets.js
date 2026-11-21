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
      /* the nine cabinets of the committee: each has its own Military Resources Booklet. side is the side it starts on (Allied "me", Central "foe";
         the neutrals' default is "ne" and a chair picks a side when loading their forces). code is the short tag drawn on its troops on the map. */
      cabinets: [
        { id: "es", code: "ES", name: "Spain", full: "Kingdom of Spain", side: "ne", color: "#e3b505" },
        { id: "de", code: "DE", name: "Germany", full: "German Empire", side: "foe", color: "#8d949e" },
        { id: "ah", code: "AH", name: "Austria-Hungary", full: "Austria-Hungary", side: "foe", color: "#e0569b" },
        { id: "ot", code: "OT", name: "Ottoman", full: "Ottoman Empire", side: "foe", color: "#2fa36b" },
        { id: "us", code: "US", name: "USA", full: "United States of America", side: "ne", color: "#3d6bff" },
        { id: "fr", code: "FR", name: "France", full: "France", side: "me", color: "#38b6e8" },
        { id: "gb", code: "GB", name: "Britain", full: "Great Britain", side: "me", color: "#ff453a" },
        { id: "ru", code: "RU", name: "Russia", full: "Imperial Russia", side: "me", color: "#a259f0" },
        { id: "nl", code: "NL", name: "Netherlands", full: "The Netherlands", side: "ne", color: "#ff8a00" }
      ],
      /* each cabinet's order of battle from its booklet (RISMUN XX HCC Military Resources Booklet, WW1), keyed by cabinet id.
         units: [class code, unit name, strength %, command authority] in the booklet's order. A unit the booklet lists as "Not Found" (0%) is not
         raised yet and is left out when the forces are loaded. The booklet caps each cabinet at 21 units. Class codes are copied as the booklet gives
         them, even where the name suggests another class (Germany's A7V armour detachment is listed as SF, Russia's cruiser flotilla as BAT). */
      booklets: {
        es: { country: "Spain", units: [
          ["INF", "1st Peninsular Line Infantry Division", 100, "King Alfonso XIII"],
          ["SF", "2nd Forces of Native Regulars", 80, "King Alfonso XIII"],
          ["L-INF", "3rd Cazadores Light Mountain Skirmish Regiment", 0, "King Alfonso XIII"],
          ["SAP", "4th Royal Artillery Field Battery", 50, "King Alfonso XIII"],
          ["MP", "5th Guardia Civil Border & Internal Security Corps", 0, "King Alfonso XIII"],
          ["BAT", "Espa\u00f1a Dreadnought Flagship", 0, "King Alfonso XIII"],
          ["CRU", "Reina Regente Protected Cruiser Flotilla", 40, "King Alfonso XIII"],
          ["SUB", "Straits of Gibraltar Patrol Submarine Flotilla", 0, "King Alfonso XIII"]
        ] },
        de: { country: "Germany", units: [
          ["INF", "1st Royal Prussian Guard Infantry Division", 100, ""],
          ["INF", "2nd Bavarian Crown Prince Field Regiment", 80, ""],
          ["INF", "3rd Great General Staff Reserve Corps", 100, ""],
          ["INF", "4th Saxon Line Infantry Regiment", 100, ""],
          ["SF", "5th Assault Battalion \u201cSto\u00dftruppen\u201d Unit", 0, ""],
          ["SF", "6th Imperial Guard Armor Detachment (A7V)", 0, ""],
          ["SAP", "7th Heavy Railway Siege Battery", 100, ""],
          ["SAP", "8th Krupp 420mm Howitzer \u201cBig Bertha\u201d Brigade", 70, ""],
          ["H-INF", "9th Imperial Machine Gun Corps", 40, ""],
          ["L-INF", "10th J\u00e4ger Light Skirmisher Battalion", 100, ""],
          ["CAV", "11th Imperial Uhlan Mounted Regiment", 80, ""],
          ["MP", "12th Feldgendarmerie Military Corps", 80, ""],
          ["BAT", "SMS High Seas Fleet Dreadnought Flagship", 0, ""],
          ["BAT", "1st Imperial Battleship Squadron", 40, ""],
          ["SUB", "1st Unrestricted U-Boat Submarine Flotilla", 0, ""],
          ["SUB", "2nd Atlantic Commerce Raider U-boat Unit", 30, ""],
          ["CRU", "SMS Emden Light Cruiser Detachment", 50, ""]
        ] },
        ah: { country: "Austria-Hungary", units: [
          ["INF", "1st Vienna Common Army Infantry Division", 100, "Emperor Franz Joseph I"],
          ["INF", "2nd Tyrolean Kaiserj\u00e4ger Alpine Regiment", 80, "Emperor Franz Joseph I"],
          ["L-INF", "3rd Bosnian-Herzegovinian Infantry Battalion", 100, "Emperor Franz Joseph I"],
          ["SAP", "4th Skoda 305mm Heavy Siege Howitzer Battery", 100, "Emperor Franz Joseph I"],
          ["H-INF", "5th Isonzo Front Fortress Machine Gun Corps", 0, "Emperor Franz Joseph I"],
          ["CAV", "6th Royal Hungarian Honv\u00e9d Mounted Hussars", 0, "Istv\u00e1n Tisza"],
          ["INF", "7th Royal Hungarian Landwehr Infantry Brigade", 100, "Istv\u00e1n Tisza"],
          ["MP", "8th Hungarian Territorial Defense Guard Corps", 70, "Istv\u00e1n Tisza"],
          ["SF", "9th K.u.K Jagdkommando Special Assault Battalion", 40, "Emperor Franz Joseph I"],
          ["INF", "10th Galician Border Defense Regiment", 80, "Emperor Franz Joseph I"],
          ["BAT", "SMS Viribus Unitis Battleship Flagship", 0, "Emperor Franz Joseph I"],
          ["BAT", "1st Tegetthoff Class Dreadnought Division", 40, "Emperor Franz Joseph I"],
          ["SUB", "K.u.K Adriatic U-Boat Flotilla (Pula)", 0, "Emperor Franz Joseph I"],
          ["CRU", "SMS Novara Armored Cruiser Detachment", 30, "Emperor Franz Joseph I"]
        ] },
        ot: { country: "Ottoman Empire", units: [
          ["INF", "1st Ottoman 19th Infantry Division (Gallipoli)", 100, "Mustafa Kemal Atat\u00fcrk"],
          ["SF", "2nd 5th Army Corps Assault Shock Detachment", 80, "Mustafa Kemal Atat\u00fcrk"],
          ["H-INF", "3rd Conkbayiri Machine Gun & Trench Defense Battalion", 0, "Mustafa Kemal Atat\u00fcrk"],
          ["L-INF", "4th Anafartalar Light Skirmish Brigade", 100, "Mustafa Kemal Atat\u00fcrk"],
          ["SF", "5th Te\u015fkil\u00e2t-\u0131 Mahsusa", 0, "Enver Pasha"],
          ["INF", "6th Ottoman 3rd Field Army", 100, "Enver Pasha"],
          ["INF", "7th Imperial Ottoman Guard Infantry Battalion", 100, "Enver Pasha"],
          ["SAP", "8th Krupp Coastal Fortified Siege Guns", 70, "Enver Pasha"],
          ["CAV", "9th Ottoman Irregular Cavalry Corps", 40, "Enver Pasha"],
          ["INF", "10th Sinai-Palestine Expeditionary Division", 80, "Enver Pasha"],
          ["MP", "11th Gendarmerie Internal Security Force", 50, "Enver Pasha"],
          ["BAT", "Yavuz Sultan Selim (ex-SMS Goeben Flagship)", 0, "Enver Pasha"],
          ["CRU", "Midilli (ex-SMS Breslau Light Cruiser)", 40, "Enver Pasha"],
          ["SUB", "Nusret Mine-Layer & Coastal Defense Flotilla", 0, "Enver Pasha / Atat\u00fcrk"]
        ] },
        us: { country: "USA", units: [
          ["INF", "1st Infantry Division (\u201cThe Big Red One\u201d)", 100, "President Woodrow Wilson"],
          ["INF", "2nd US Infantry Division", 80, "President Woodrow Wilson"],
          ["INF", "42nd Infantry Division (\u201cRainbow Division\u201d)", 0, "President Woodrow Wilson"],
          ["ARM", "1st US Army Tank Corps", 50, "President Woodrow Wilson"],
          ["SF", "5th US Marine Corps Regiment", 0, "President Woodrow Wilson"],
          ["H-INF", "6th Browning Automatic Rifle Machine Gun Corps", 0, "President Woodrow Wilson"],
          ["SAP", "7th US Army Combat Engineer Siege Corps", 100, "President Woodrow Wilson"],
          ["L-INF", "8th US Trench Raider & Shotgun Recon Unit", 70, "President Woodrow Wilson"],
          ["MP", "9th US Provost Marshal General Security Guard", 40, "President Woodrow Wilson"],
          ["CAV", "10th US Cavalry Provisional Squadron", 80, "President Woodrow Wilson"],
          ["BAT", "USS Florida Battleship Squadron 9 (Grand Fleet)", 0, "President Woodrow Wilson"],
          ["BAT", "USS Texas Atlantic Dreadnought Division", 40, "President Woodrow Wilson"],
          ["CRU", "US Atlantic Convoys Submarine-Hunter Flotilla", 0, "President Woodrow Wilson"],
          ["SUB", "US Navy Coastal Submarine Patrol Detachment", 0, "President Woodrow Wilson"]
        ] },
        fr: { country: "France", units: [
          ["INF", "1st Metropolitan Line Infantry Division", 100, "President Raymond Poincar\u00e9"],
          ["INF", "2nd French Army Field Infantry Corps", 80, "President Raymond Poincar\u00e9"],
          ["L-INF", "3rd Chasseurs Alpins Mountain Skirmish Division", 0, "President Raymond Poincar\u00e9"],
          ["INF", "4th Colonial Infantry Division", 50, "President Raymond Poincar\u00e9"],
          ["SAP", "5th Canon de 75mm Rapid Artillery Brigade", 0, "President Raymond Poincar\u00e9"],
          ["SAP", "6th Heavy Siege Mortar & Counter-Battery Corps", 0, "President Raymond Poincar\u00e9"],
          ["ARM", "7th French Armored Tank Battalion", 100, "President Raymond Poincar\u00e9"],
          ["H-INF", "8th St. \u00c9tienne M1907 Machine Gun Company", 70, "President Raymond Poincar\u00e9"],
          ["CAV", "9th Cuirassier Heavy Cavalry Squadron", 40, "President Raymond Poincar\u00e9"],
          ["MP", "10th Gendarmerie Nationale Provost Guard", 80, "President Raymond Poincar\u00e9"],
          ["BAT", "1st French Dreadnought Division", 0, "President Raymond Poincar\u00e9"],
          ["BAT", "2nd Mediterranean Battleship Squadron", 40, "President Raymond Poincar\u00e9"],
          ["CRU", "1st Armored Battlecruiser Division", 0, "President Raymond Poincar\u00e9"],
          ["CRU", "2nd Light Cruiser Escort Flotilla", 90, "President Raymond Poincar\u00e9"],
          ["SUB", "English Channel Defensive Submarine", 30, "President Raymond Poincar\u00e9"],
          ["SUB", "Mediterranean Anti-U-Boat Submarine Flotilla", 0, "President Raymond Poincar\u00e9"],
          ["CRU", "Atlantic Convoy Escort Destroyer Squadron", 40, "President Raymond Poincar\u00e9"]
        ] },
        gb: { country: "Britain", units: [
          ["INF", "1st British Expeditionary Force Regular Division", 100, "Prime Minister H.H. Asquith"],
          ["INF", "2nd Kitchener\u2019s New Army Volunteer Corps", 80, "Prime Minister H.H. Asquith"],
          ["INF", "3rd ANZAC Expeditionary Division", 0, "Prime Minister H.H. Asquith"],
          ["INF", "4th Canadian Corps", 50, "Prime Minister H.H. Asquith"],
          ["ARM", "5th Heavy Branch Tank Corps", 0, "Prime Minister H.H. Asquith"],
          ["H-INF", "6th Vickers Heavy Machine Gun Battalion", 0, "Prime Minister H.H. Asquith"],
          ["SAP", "7th Royal Engineers Heavy Siege Artillery & Tunnellers", 100, "Prime Minister H.H. Asquith"],
          ["L-INF", "8th Highland Light Infantry Skirmish Regiment", 70, "Prime Minister H.H. Asquith"],
          ["CAV", "9th Imperial Yeomanry Cavalry Brigade", 40, "King George V"],
          ["MP", "10th Military Foot Police Provost Guard", 80, "Prime Minister H.H. Asquith"],
          ["BAT", "HMS Iron Duke (Grand Fleet Battleship Flagship)", 0, "King George V"],
          ["BAT", "1st Dreadnought Battle Squadron", 40, "King George V"],
          ["BAT", "2nd Queen Elizabeth Class Super-Dreadnought Division", 0, "King George V"],
          ["CRU", "1st Battlecruiser Squadron (HMS Lion & Queen Mary)", 90, "King George V"],
          ["CRU", "Dover Patrol Anti-Submarine & Destroyer Flotilla", 30, "King George V"],
          ["SUB", "Royal Navy E-Class Submarine Flotilla", 0, "King George V"],
          ["SF", "Royal Marine Light Infantry Brigade", 0, "King George V"]
        ] },
        ru: { country: "Russia", units: [
          ["INF", "1st Imperial Guard Rifle Division", 100, "Tsar Nicholas II"],
          ["INF", "2nd Russian 1st Army Field Corps", 80, "Tsar Nicholas II"],
          ["INF", "3rd Southwestern Front Assault Division", 0, "Tsar Nicholas II"],
          ["INF", "4th Caucasian Grenadier Division", 50, "Tsar Nicholas II"],
          ["CAV", "5th Don Cossack Mounted Cavalry", 0, "Tsar Nicholas II"],
          ["CAV", "6th Imperial Guard Cavalry Division", 0, "Tsar Nicholas II"],
          ["SAP", "7th Imperial Heavy Field Siege Artillery Brigade", 100, "Tsar Nicholas II"],
          ["H-INF", "8th Maxim M1910 Machine Gun Fortress Battalion", 0, "Tsar Nicholas II"],
          ["L-INF", "9th Siberian Light Rifle Regiment", 40, "Tsar Nicholas II"],
          ["MP", "10th Petrograd Home Front Security & Logistics Guard", 80, "Prime Minister Ivan Goremykin"],
          ["MP", "11th Imperial Gendarmerie Reserve Provost Unit", 50, "Prime Minister Ivan Goremykin"],
          ["BAT", "1st Baltic Fleet Dreadnought Division", 0, "Tsar Nicholas II"],
          ["BAT", "2nd Black Sea Fleet Battleship Division", 40, "Tsar Nicholas II"],
          ["BAT", "Baltic Armored Cruiser Escort Flotilla", 0, "Tsar Nicholas II"],
          ["CRU", "Imperial Russian Submarine Division", 50, "Tsar Nicholas II"]
        ] },
        nl: { country: "Netherlands", units: [
          ["INF", "1st Field Army Border Defense Division", 100, "Queen Wilhelmina"],
          ["L-INF", "2nd Royal Guards Grenadiers & Jagers", 80, "Queen Wilhelmina"],
          ["SAP", "3rd New Dutch Waterline Heavy Artillery Battery", 0, "Queen Wilhelmina"],
          ["MP", "4th Royal Marechaussee Military Police Corps", 50, "Queen Wilhelmina"],
          ["CAV", "5th Royal Mounted Hussar Reconnaissance Unit", 0, "Queen Wilhelmina"],
          ["BAT", "HNLMS De Zeven Provinci\u00ebn Coastal Defense Ship", 0, "Queen Wilhelmina"],
          ["CRU", "North Sea Mine-Laying & Torpedo Escort Division", 40, "Queen Wilhelmina"],
          ["SUB", "1st Coastal Neutrality Submarine Patrol", 0, "Queen Wilhelmina"]
        ] }
      }
    }
  };
})();
