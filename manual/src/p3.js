"use strict";
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const MO = "Morale", MP = "Battle Map";

module.exports = [
/* 25 */
{ id: "morale", part: MO, title: "Setting morale",
  lead: "One figure per side, from 0 to 100. You set it; it changes the damage the attacker deals.",
  body: `
  ${fig("morale", "The Morale page: one card per side, each with a big readout, a slider, a number box and quick steps.", { win: [10, 58], marks: [[1, 3, 39.5], [2, 3, 50.4], [3, 3, 58.5]] })}
  ${legend([
    "<b>Readout.</b> The side’s current morale, with the number of units in the field.",
    "<b>Set morale.</b> Drag the slider, or type a number. Both stay in step.",
    "<b>Quick steps.</b> −10, −5, +5 and +10 move it by that amount."
  ])}
  ${steps([
    ["Open Morale", "Choose <b>Morale</b> in the sidebar. Both sides appear side by side, named for the topic (for example <i>French Army</i>, <i>British Army</i>)."],
    ["Change the figure", "Drag the slider, type a value (whole numbers, 0–100) or press a quick step. Values outside the range are clamped: typing 140 gives 100."],
    ["That is all", "There is no Save button. The new figure is written to the server immediately and added to the activity log, for example <i>Morale (French Army): 50% → 60%</i>."]
  ])}
  <div class="g2">
    ${cd("Everyone starts at 50", `<p>Until you change it, both sides stand at <b>50%</b>, in both topics.</p>`, "w")}
    ${cd("Delegates see only their own", `<p>A delegate sees <b>only their own side’s</b> figure. A delegate whose character is on no side today sees no morale at all. Their screens refresh it within 15 seconds.</p>`, "w")}
  </div>
  ${note("If Morale is switched off", "When <b>Morale</b> is off in <i>Rules &amp; Formulas</i> ([[rules-formula]]), the page shows a note and morale does not affect damage (it counts as 100%). You can still set the figure; it simply is not used.".replace("[[rules-formula]]", ref("rules-formula")))}
  ${warn("Set it before you resolve combat", "The calculator reads morale when you tick the attackers. If you change it afterwards, re-open the engagement or use the <i>Use … morale</i> link to pick the new figure up ([[calc-cond]]).".replace("[[calc-cond]]", ref("calc-cond")))}`
},

/* 26 */
{ id: "morale-use", part: MO, title: "How morale affects combat",
  lead: "With the standard method, damage is the attackers’ total attack, scaled by their morale.",
  body: `
  <div class="g-side" style="--w:62mm">
    ${fig("morale-card", "A side’s morale card. The slider and number box stay in step.", { cls: "plain" })}
    <div style="display:flex;flex-direction:column;gap:2.4mm">
      <h2 style="margin-top:0">The standard formula</h2>
      <p>The default damage formula is <code>atk * morale / 100 * mult + bonus</code>. At 50% morale a force with a combined attack of 13 deals <b>6.5</b> damage. At 100% it deals 13; at 0% it deals nothing.</p>
      ${tbl(["Attacker morale", "ATK 13 deals"], [["100%", "13"], ["75%", "9.75"], ["50%", "6.5"], ["25%", "3.25"], ["0%", "0"]], "box")}
    </div>
  </div>
  <h2>Whose morale is used</h2>
  <ul>
    <li><b>The attacking side’s</b> morale scales the damage of the hit.</li>
    <li>With <b>Counter-attack</b> on, the <b>defending side’s</b> morale scales the strike back.</li>
    <li>You can override either figure for a single engagement without touching the side’s real morale ([[calc-cond]]).</li>
  </ul>
  <h2>When to change it</h2>
  <p>Morale is your lever for what the story does to the troops. SENTINEL never changes it for you. Suggestions only; your committee’s booklet governs:</p>
  ${tbl(["Event", "A sensible move"], [
    ["A decisive victory, a rousing speech, a ruler present at the front", "+5 to +10 for the winning side"],
    ["A defeat, a siege lost, a commander killed", "−5 to −10 for the losing side"],
    ["Plague, famine, mutiny, unpaid wages", "−10 or more, announced to the committee"],
    ["A new alliance or a long rest", "+5"]
  ], "box")}
  ${tip("Announce it", "Delegates only see their own figure, so a move in morale is a message. Say aloud what happened so the committee understands why their numbers shifted.")}`
},

/* 27 */
{ id: "map", part: MP, title: "The Battle Map",
  lead: "The theatre, its terrain, the battle lines and every troop on one shared map. What you change here, everyone sees.",
  body: `
  ${fig("map-placed", "The Battle Map for Topic 1 with troops placed. The French Army’s units are on the left, the British on the right.", { marks: [[1, 1.4, 9.8], [2, 1.4, 23.4], [3, 15.5, 23.4], [4, 85.5, 23.4], [5, 1.4, 91]] })}
  ${legend([
    "<b>Chair bar.</b> Choose a tool (Reshape, Draw a line, Cities) and manage battle lines.",
    "<b>French Army column.</b> The units to place, and those already on the map.",
    "<b>The map.</b> Terrain, borders, cities, battle lines and troops. Drag to pan, scroll to zoom.",
    "<b>British Army column.</b> The same, for the other side.",
    "<b>Terrain card.</b> What rivers, forest and mountains do to a force ([[map-terrain]])."
  ].map(x => x.replace("[[map-terrain]]", ref("map-terrain"))))}
  <h2>What you can do here</h2>
  ${tbl(["Task", "How", "Page"], [
    ["Look around", "Pan, zoom, switch terrain on or off", "[[map-nav]]"],
    ["Put a unit on the map", "Drag it from your column, or click it and click the map", "[[map-place]]"],
    ["Check a troop and how far it can move", "Click its marker", "[[map-troop]]"],
    ["Move or bend a battle line", "Reshape tool", "[[map-lines]]"],
    ["Add a new battle line", "Draw a line tool", "[[map-draw]]"],
    ["Give a city to a side", "Cities tool", "[[map-city]]"]
  ], "box")}
  ${note("Delegates see the same map", "Delegates see lines, cities and troops on their own Battle Map page but cannot change them. It updates by itself when you save.")}`
},

/* 28 */
{ id: "map-nav", part: MP, title: "Moving around the map",
  lead: "Pan, zoom and switch the ground on or off. None of it changes anything for other people.",
  body: `
  ${fig("map-empty", "The map before any troops are placed. The controls at the top centre are Zoom in, Zoom out, Fit and Terrain.", { win: [0, 86], marks: [[1, 42.8, 24.6], [2, 46.4, 24.6], [3, 49.3, 24.6], [4, 52.7, 24.6]] })}
  ${legend([
    "<b>＋ Zoom in.</b> Closer, by about a third each press.",
    "<b>− Zoom out.</b> Further away.",
    "<b>Fit.</b> Return to the whole theatre.",
    "<b>Terrain.</b> Show or hide the ground: relief, rivers, forests, marshes and mountain names."
  ])}
  <div class="g2">
    ${cd("With a mouse or trackpad", `<ul><li><b>Pan:</b> press on empty map and drag.</li><li><b>Zoom:</b> scroll the wheel, or pinch on a trackpad.</li><li><b>Fit:</b> press <b>Fit</b>.</li></ul>`, "w")}
    ${cd("On a tablet", `<ul><li><b>Pan:</b> drag with one finger on empty map.</li><li><b>Zoom:</b> use ＋ and −.</li><li>A press that wanders a few pixels still counts as a tap.</li></ul>`, "w")}
  </div>
  <h2>What the legend means</h2>
  <p>The key under the map lists what you are looking at: <b>Battle line</b> (the white line), <b>River</b> (blue), <b>Forest</b> (green dots), <b>Low to high ground</b> (a blue-green to pale-rock tint, with contours every 200 m and a heavier line every 1000 m), <b>Key city</b> (white dot) and a dot each for the two sides’ colours.</p>
  <p><i>“Zoom in for more cities”</i>: only the larger cities show at first. Zooming in reveals smaller ones.</p>
  ${tip("Pinpoint beats panning", "To find a unit, select it and press <b>Pinpoint location</b> instead of hunting for it. The map glides to it, zooms in and pulses a ring three times ([[map-troop]]).")}
  ${note("Reduced motion", "If your device asks for reduced motion, the map jumps rather than glides.")}`
},

/* 29 */
{ id: "map-place", part: MP, title: "Placing troops",
  lead: "Units come from the delegates’ order of battle. You put them on the map and move them as the committee rules.",
  body: `
  ${fig("map-columns", "Each side’s column lists the units still to place, grouped by class, under <b>Active</b> (on a front) and <b>Reserve</b> (not yet deployed, tagged <i>Reserve</i>).", { win: [0, 64] })}
  ${steps([
    ["Pick a unit", "In a side’s column, find the unit under its class. Each row shows its symbol, name, <i>front · ATK · HP · MOV</i>."],
    ["Put it down", "<b>Drag the row onto the map</b>, or <b>click the row, then click the map</b>. The column header reads <i>“Click the map to put down Infantry 2. Esc to stop.”</i>"],
    ["Move it later", "Drag a marker on the map to a new place. The change saves automatically and every screen shows it."],
    ["Stop placing", `Press ${kbd("Esc")}. Clicking a marker also cancels placing.`]
  ])}
  <div class="g2">
    ${cd("Symbols", `<p>Each marker uses a military symbol for the unit’s sub class (infantry, cavalry, ship, aircraft…) in the side’s colour: <b>blue</b> for the first side, <b>red</b> for the second, grey-slate for neutral.</p>`, "w")}
    ${cd("Limits", `<p>A topic can hold <b>200 troops</b> on the map. Destroyed units are not offered for placing, and a unit that is already on the map leaves your column and appears under <b>On the map</b>.</p>`, "w")}
  </div>
  <h2>On the map</h2>
  <p>Beneath each side’s unit list, <b>On the map</b> lists that side’s placed troops with a mini HP bar and <i>HP/Full HP</i>. Press a row to select it, and if it is out of sight the map pans to bring it into view.</p>
  ${note("Why a unit seems to be missing", "If a unit does not appear in your list, the delegate has not added it, or it is already on the map, or it is destroyed. All three are normal. If a whole delegation is missing, see [[board-filter]].")}`
},

/* 30 */
{ id: "map-troop", part: MP, title: "A troop on the map",
  lead: "Click a marker to see its stats, how far it can go this turn, and what you can do with it.",
  body: `
  ${fig("map-troop", "A selected troop: its card sits at the top of its side’s column and its reach is drawn on the map.", { win: [4, 82], marks: [[1, 3.6, 25.5], [2, 3.1, 44.6], [3, 3.1, 48.8], [4, 50, 52.8], [5, 3.1, 75.4], [6, 3.1, 83.8]] })}
  ${tbl(["", "Control", "What it does"], [
    ["1", "<b>Troop card</b>", "Symbol, name, HP, ATK, MOV, RNG and where it stands (latitude and longitude)."],
    ["2", ui("Pinpoint location"), "Glides the map to the troop and pulses a ring on it three times."],
    ["3", ui("Open in calculator"), "Adds the unit to the calculator and switches page, in one click."],
    ["4", "<b>Reach</b>", "Solid outline: the full move this turn. Dashed: half of it."],
    ["5", ui("−1 HP / +1 HP"), "For units <i>not</i> owned by a delegate. For a delegate’s unit SENTINEL says <i>“That unit belongs to …: they change its HP.”</i> Also <b>Add to battle tray</b>."],
    ["6", ui("Take off the map"), "Removes the marker for everyone. The unit stays in the order of battle."]
  ], "box")}
  <h2>How far can it move?</h2>
  <p>Select a troop with MOV above 0 and the map draws its <b>reach</b> for this turn. One point of MOV is <b>30 km</b> on open ground, so a unit with MOV 5 reaches 150 km. The <b>solid line</b> is the full move and the <b>dashed line</b> half of it.</p>
  <ul>
    <li><b>Land units:</b> mountains, forest, marsh and river crossings shorten the reach ([[map-terrain]]).</li>
    <li><b>Ships:</b> water only.</li>
    <li><b>Aircraft:</b> ignore terrain.</li>
  </ul>
  ${note("The map’s HP and the delegate’s HP", "Applying a battle ([[calc-apply]]) updates the HP on the map for everyone. Delegates keep their own record, so tell them the result.")}`
},

/* 31 */
{ id: "map-terrain", part: MP, title: "Terrain and what it does",
  lead: "The map shows where the ground is hard. You rule on how much it matters.",
  body: `
  ${fig("map-night", "Night mode draws the same terrain on a dark base: major rivers, forests and marsh stand out.", { cls: "crop", h: "88mm" })}
  <p>Press <b>Show</b> on the <b>Terrain</b> card under the map to see the suggested effects. They are guidance for your rulings, not automatic: <i>“Suggested values: put them in the Situational multiplier of the Combat Calculator. The chairs rule on any crossing.”</i></p>
  ${tbl(["Terrain", "Movement", "In a fight"], [
    ["<b>Major river</b>", "Crossed only at a bridge or ford; the move ends on the far bank.", "Attacking across it ×0.75, defending the bank ×1.25."],
    ["<b>Minor river</b>", "Crossing costs half the move.", "Attacking across it ×0.9."],
    ["<b>Mountains</b>", "Move ×0.5. Heavy guns and wagons keep to the passes.", "Defender ×1.3. Archers and rifles on the heights reach further."],
    ["<b>Thick forest</b>", "Move ×0.6. Cavalry and guns keep to the roads.", "Defender ×1.2, ranged and cavalry ×0.75."],
    ["<b>Marsh and flood plain</b>", "Move ×0.4. Cavalry and guns cannot enter off the roads.", "Attacker ×0.8."]
  ], "box")}
  <div class="g2">
    ${cd("Reach is automatic", `<p>The movement column is built into each troop’s reach shape ([[map-troop]]). Mountains, forest and marsh shorten it; a major river blocks it except at a crossing.</p>`, "w")}
    ${cd("Fighting is yours to rule", `<p>The “in a fight” numbers are <b>not</b> applied automatically. Choose the matching <i>Situational multiplier</i> chip (×0.75, ×1.25…) in the calculator ([[calc-cond]]).</p>`, "w")}
  </div>
  ${tip("Approximate by design", "Rivers, ranges, forests and marshes come from real geography, but the map notes that a crossing is the chairs’ call. The terrain is a guide to where the ground is hard, not a survey.")}`
},

/* 32 */
{ id: "map-lines", part: MP, title: "Reshaping a battle line",
  lead: "Battle lines show where the armies face each other. Move and bend them as the war moves.",
  body: `
  ${fig("map-bar-line", "With a line chosen, the chair bar shows its name, how many points it has and what you can do.", { marks: [[1, 1.2, 22], [2, 8.4, 71.8], [3, 73.9, 8], [4, 71.5, 37]] })}
  ${legend([
    "<b>Reshape</b> is the active tool.",
    "<b>Battle lines.</b> Press a line’s name to choose it.",
    "<b>Zone.</b> Tint one side of the line (see below).",
    "<b>Rename · Fewer points · Remove point · Delete line.</b>"
  ])}
  ${steps([
    ["Choose a line", "Press the line on the map, or its name under <b>Battle lines</b>. The bar shows its name and <i>16 points</i>."],
    ["Move a point", "<b>Drag a round point</b> to a new place. <b>Drag a small point</b> to bend the line there."],
    ["Remove a point", "Click a round point to choose it, then <b>Remove point</b>, or double-click the point. A line needs at least two points, so the button greys out at two."],
    ["Tidy it", "<b>Fewer points</b> simplifies the line (<i>“16 points down to 9”</i>). <b>Rename</b> changes its label (up to 40 characters)."],
    ["Delete it", "<b>Delete line</b> asks first: <i>“Delete the line? ‘…’ goes for everyone.”</i> It does."]
  ])}
  <h2>The zone</h2>
  <p>The zone tints one side of a line in the sides’ colours so everyone can see which ground each army holds.</p>
  ${tbl(["Line type", "Choices", "Effect"], [
    ["Open line (a front)", "<b>Off</b> · <b>Blue in the west</b> · <b>Blue in the east</b>", "Tints the ground on each side of the line: blue on one side, red on the other."],
    ["Closed line (it returns to where it began)", "<b>Off</b> · <b>Blue inside</b> · <b>Red inside</b>", "Tints the area inside, such as a landing zone or a besieged city."]
  ], "box")}
  ${note("Saved as you go", "Each edit saves to the server and appears on delegates’ maps. <b>Two chairs redrawing lines at the same moment can overwrite each other</b>, because lines are stored as a whole list. Agree who edits lines.")}`
},

/* 33 */
{ id: "map-draw", part: MP, title: "Drawing and restoring lines",
  lead: "Add a new line, from one end to the other, in a few clicks.",
  body: `
  ${fig("map-draw", "Draw a line: each click lays down a point. The bar counts them and offers Finish line.", { win: [0, 78], marks: [[1, 36.1, 31.5], [2, 43, 34.7], [3, 50, 32.7]] })}
  ${steps([
    ["Choose Draw a line", "In the chair bar press <b>Draw a line</b>. The bar explains: <i>“Click the map to lay down the points of a new line, from one end to the other.”</i>"],
    ["Click the map", "Each click adds a point (1, 2, 3 on the figure). The bar counts them. <b>Undo point</b> removes the last; <b>Cancel</b> discards the draft."],
    ["Finish", "Press <b>Finish line</b> (it needs two points or more). SENTINEL asks you to name it. The line is added and chosen, and the tool returns to <b>Reshape</b>."]
  ])}
  ${cols(2, [
    cd("Limits", `<p><b>12 lines</b> per map. <b>120 points</b> per line. SENTINEL tells you when you reach either.</p>`, "w"),
    cd("Closing a loop", `<p>End a line where it began and it becomes an <i>area</i>: its zone can then colour the inside.</p>`, "w"),
  ])}
  <h2>Restore defaults</h2>
  <p>Press <b>Restore defaults</b> at the right of the <b>Battle lines</b> row to go back to the topic’s starting lines. SENTINEL asks first: <i>“Restore the starting lines? Lines you drew on this map are lost.”</i> Choose <b>Restore</b> to confirm.</p>
  ${tbl(["Topic", "Starting lines"], [
    ["Topic 1 · The Hundred Years’ War", "<b>Anglo-Burgundian front, 1429</b> and <b>Guyenne front, 1429</b>."],
    ["Topic 2 · The First World War", "None. The map starts empty and you draw the fronts."]
  ], "box")}
  ${warn("Restore removes everything you drew", "Restoring replaces <i>all</i> lines on that topic’s map, not just the one you were working on. It affects every screen. Troops and cities are untouched.")}`
},

/* 34 */
{ id: "map-city", part: MP, title: "Cities, and keeping the map in sync",
  lead: "Give cities to the side that holds them. Then understand how the map saves and what to do if it does not.",
  body: `
  ${fig("map-bar-city", "The Cities tool: click a city, then say who holds it.", { marks: [[1, 14.2, 12.6], [2, 19.9, 14], [3, 35.6, 11.2], [4, 91, 14]] })}
  ${steps([
    ["Choose Cities", "Press <b>Cities</b> in the chair bar. It says <i>“Click any city on the map, then give it to a side.”</i>"],
    ["Click a city", "The bar shows its name and whether it was <i>Given to a side by the chairs</i> or is the <i>Default</i>."],
    ["Pick a side", "Press the first side, the second side or <b>Neutral</b>. The city’s dot takes that colour for everyone."],
    ["Undo a change", "<b>Back to default</b> returns the city to its starting side."]
  ])}
  <p>Only the larger cities show when the map is zoomed out. Zoom in to reach smaller ones.</p>
  ${fig("map-city", "A city selected on the map.", { cls: "crop", h: "64mm" })}
  <h2>How the map saves</h2>
  <ul>
    <li><b>Lines and cities</b> save the moment you finish an edit.</li>
    <li><b>Troops</b> save automatically. If a delegate changed a unit’s HP at the same moment, SENTINEL merges your move with their change instead of overwriting it. Where you both changed the same field, <b>yours wins</b>.</li>
    <li>If a save fails you see <i>“Could not save the lines, try again”</i>, <i>“Could not save the city, try again”</i> or <i>“Could not save the troops, try again”</i>, and the map reloads from the server.</li>
  </ul>
  ${tip("If the map looks out of date", "Switch to another page and back, or reload. The page reads the shared copy from the server each time it opens.")}`
}
];
