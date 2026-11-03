"use strict";
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const OV = "Overview", OB = "Order of Battle", MO = "Morale";
const dot = c => `<span class="dot" style="background:${c}"></span>`;

module.exports = [
/* 15 */
{ id: "ov", part: OV, title: "The Forces overview",
  lead: "Your first stop each turn. How strong is each side, how is it changing, and what happened since you last looked?",
  body: `
  ${fig("overview", "Overview for Topic 1. The French Army is selected; the chart fills in as forces change.", { marks: [[1, 56.4, 24.2], [2, 82.9, 24.2], [3, 21.9, 31.4], [4, 74.4, 31.4], [5, 21.9, 82.2]] })}
  ${legend([
    "<b>Side switch.</b> Choose which side the page shows.",
    "<b>Collapse all / Expand all.</b> Fold every panel to its one-line summary, or open them all.",
    "<b>Strength over time.</b> Combat strength, units and morale, with a chart ([[ov-chart]]).",
    "<b>Forces by class.</b> A donut of units still in the field.",
    "<b>Four tiles.</b> Units, hit points, attack power, losses ([[ov-tiles]])."
  ].map(x => x.replace("[[ov-chart]]", ref("ov-chart")).replace("[[ov-tiles]]", ref("ov-tiles"))))}
  <h2>One side at a time</h2>
  <p>The Overview shows <b>one side</b> at once. The switch at the top right reads, for example, <i>French Army · 19 units</i> and <i>British Army · 19 units</i>: the unit count is the number still in the field. Press the other side to flip the whole page.</p>
  <h2>Everything folds</h2>
  <p>Press any panel title to collapse it. While folded, its subtitle becomes a one-line summary (for example <i>“18 at full strength · 1 below 50% · 1 destroyed”</i>), so you can skim the page without losing detail. Your choice is remembered on this device.</p>
  ${note("An empty tracker", "If delegates have not added any units yet, the page says <i>No forces recorded yet</i>. As a chair you cannot add units; ask the delegates to enter theirs or check that they have a character and a side ([[sides]]).")}
`
},

/* 16 */
{ id: "ov-chart", part: OV, title: "Strength over time and by class",
  lead: "A running picture of how much fight each side has left, drawn from every change you and the delegates make.",
  body: `
  ${fig("ov-top", "The two top panels: Force strength over time (left) and Forces by class (right).")}
  <h2>Force strength over time</h2>
  <p>The left side of the panel gives three headline numbers for the selected side:</p>
  ${tbl(["Number", "What it means"], [
    ["<b>88%</b> Combat strength", "Hit points left across units in the field, as a share of their full hit points. Example: 100.8 of 114 HP is 88%."],
    ["<b>19</b> Units in the field", "Units that are not destroyed, plus how many have been lost (<i>· 1 lost</i>)."],
    ["<b>50%</b> Morale", "The side’s current morale. It only appears while Morale is switched on in the rules ([[morale]])."]
  ].map(r => r.map(c => c.replace("[[morale]]", ref("morale")))), "box")}
  <p>The chart on the right draws a line per side. Use the switch above it to plot <b>Hit points</b>, <b>Units</b> or <b>Attack</b>. <b>Every move, HP change and battle adds a point</b>, so a busy turn bends the line. Until the first change the chart shows <i>“The chart fills in as your forces change.”</i></p>
  <h2>Forces by class</h2>
  <p>The donut shows the side’s units still in the field by class: Army, Navy and, in Topic 2, Airforce and Marine. Percentages and counts sit underneath. Class colours are set on the Rules page ([[rules-more]]) and reused on every card and chart.</p>
  ${tip("Compare sides quickly", "Flip the side switch and watch the same chart: the blue line is the first side, the red line the second. Both are always drawn, whichever side is selected.")}
  ${note("Why the chart might look flat", "The history lives in this browser. A new device starts a new chart, and clearing site data erases it. See [[data]].".replace("[[data]]", ref("data")))}`
},

/* 17 */
{ id: "ov-tiles", part: OV, title: "The four tiles",
  lead: "Totals for the selected side, each with a small trend line.",
  body: `
  ${fig("ov-tiles", "Units in the field, Hit points, Attack power and Losses.")}
  ${tbl(["Tile", "Big number", "Small print"], [
    [ui("Units in the field"), "Units that are alive and in play.", "<i>20 raised · 4 in reserve</i>: units ever added, and how many sit in Reserve rather than on the front."],
    [ui("Hit points"), "Total HP left across units in the field.", "<i>of 114 · 88% strength</i>: the total at full strength, and the percentage left."],
    [ui("Attack power"), "Effective attack: ATK <i>after</i> the strength rules and any directives for that side.", "<i>115 on the fronts</i>: the part of it that sits on a front, not in Reserve."],
    [ui("Losses"), "Units destroyed so far.", "<i>13.2 HP lost</i>: hit points lost across the whole side, destroyed units included."]
  ], "box")}
  <h2>The change badge</h2>
  <p>A grey <b>no change</b> pill, or a green ▲ or ▼ with a number, compares today with the <b>first recorded point</b>, like a market index. Green means it moved the way a commander would want: more units, more HP, more attack. A change in the wrong direction shows red. Hover to see <i>Since tracking started</i>.</p>
  <h2>The sparkline</h2>
  <p>The mini chart in each tile shows the last 40 recorded points. For <b>Losses</b> it is the HP lost over time, so a rising line means a side is bleeding.</p>
  ${cols(2, [
    cd("Why attack power can exceed raw ATK", `<p>The tile uses <i>effective</i> attack. With <b>Combat modifier</b> or a side <b>directive</b> switched on ([[rules-str]], [[rules-more]]), a unit’s effective ATK can be higher than the ATK printed on its card. Here the modifier gives +2 and the French directive +1.</p>`.replace(/\$\{ref\("rules-str"\)\}/, ref("rules-str")).replace(/\$\{ref\("rules-more"\)\}/, ref("rules-more")), "w"),
    cd("Chairs see both sides", `<p>Delegates only see their own side’s tiles. You can flip between sides, so you can spot a side that is quietly losing before its delegate raises it.</p>`, "w")
  ])}`
},

/* 18 */
{ id: "ov-ready", part: OV, title: "Sub classes and readiness",
  lead: "Which kinds of unit are left, and how healthy they are.",
  body: `
  ${fig("ov-mid", "Units by sub class (left) and Readiness (right).")}
  <h2>Units by sub class</h2>
  <p>One row per sub class (Archers, Cavalry, Infantry and so on) with its code chip, a bar and the count: <i>3 left · 1 lost</i>. The coloured part of the bar is units still in play; the <b>striped</b> part is units lost. Row colour follows the class (Army olive, Navy indigo).</p>
  <h2>Readiness</h2>
  <p>Readiness sorts every unit by <b>strength</b>: its HP left as a share of its full HP. Six bars give the counts:</p>
  ${tbl(["Bar", "Strength", "Reading"], [
    [dot("#1e8e4e") + " Full strength", "100%", "Untouched."],
    [dot("#3aa76d") + " 75–99%", "75% to just under 100%", "Light damage."],
    [dot("#e8863a") + " 50–74%", "50% to 74%", "Fair. Starts to feel the losses."],
    [dot("#d9501e") + " 10–49%", "10% to 49%", "Weak. Likely to be penalised in combat ([[rules-str]])."],
    [dot("#d70f2f") + " Under 10%", "Under 10%", "Critical. With the default strength penalty, too weak to attack."],
    [dot("#9a9aa0") + " Destroyed", "0 HP", "Counted as lost."]
  ].map(r => r.map(c => c.replace("[[rules-str]]", ref("rules-str")))), "box")}
  ${tip("Read the Overview like a doctor’s chart", "A side with 18 units at full strength and one critical unit is in a different position from a side with 19 units at 40%. Totals hide that; readiness does not.")}
  ${note("Same tiers everywhere", "These tiers colour the HP bar on every unit card, the Order of Battle and the Combat Calculator, so a red bar always means the same thing.")}`
},

/* 19 */
{ id: "ov-act", part: OV, title: "Activity, balance and battle record",
  lead: "What has happened, who is ahead where, and which engagements you have already ruled on.",
  body: `
  ${fig("ov-bot", "Recent activity (left) and Force balance by class (right).")}
  <h2>Recent activity</h2>
  <p>The eight latest entries in the activity log, newest first, with a relative time and an icon for the type: moves, HP changes, battles, rule changes and morale. Examples: <i>“Morale (French Army): 50% → 60%”</i>, <i>“Rule changed: Counter-attack switched on”</i>, <i>“Battle: Infantry 4 attacked Infantry 4 · 11 damage (100% of their HP) · 2 defenders destroyed”</i>.</p>
  <h2>Force balance by class</h2>
  <p>For each class a bar compares the two sides’ <b>hit points in the field</b>: blue for the first side, red for the second. The number on the right is the ratio, such as <i>1.16 : 1</i>. The line under the class name shows unit counts, <i>16 v 14 units</i>. If only one side has units in a class it reads <i>no British Army</i> or the like.</p>
  ${fig("ov-battles", "Battle record: every engagement you have applied, newest first.")}
  <h2>Battle record</h2>
  <p>A table of the last eight applied battles with time, attackers, defenders, damage (and counter-attack damage in brackets), the percentage of the defenders’ HP and an outcome pill. The full record, up to 300 battles, is on the Combat Calculator ([[calc-apply]]). <b>Combat calculator</b> in the panel header jumps there.</p>
  <div class="g2">
    ${cd("Night mode and printing", `<p>Collapsed panels stay collapsed in a screenshot, so fold what you do not want to show before projecting the page.</p>`, "w")}
    ${cd("The log is local", `<p>The activity log lives in this browser, per sign-in. A co-chair on another device keeps their own. See [[data]].</p>`, "w")}
  </div>`
},

/* 20 */
{ id: "board", part: OB, title: "The Order of Battle board",
  lead: "Every unit on both sides, laid out like a staff map: Reserve at the edges, the Front line at the centre.",
  body: `
  ${fig("board", "Both sides at once. The French Army is on the left, the British Army on the right; the quick combat calculation tray sits below.", { marks: [[1, 73.4, 30], [2, 2.5, 37.4], [3, 2.75, 49], [4, 26.2, 49], [5, 2.5, 76.8]] })}
  ${legend([
    "<b>Side switch.</b> <i>French Army · British Army · Both sides</i>. Chairs open on Both sides.",
    "<b>Search and class chips.</b> Narrow what the board shows ([[board-filter]]).",
    "<b>Reserve.</b> Units raised but not yet deployed.",
    "<b>Front line.</b> Units in play. Each column totals its units, HP and ATK.",
    "<b>Battle tray.</b> Set up an engagement without leaving the page ([[tray]])."
  ].map(x => x.replace("[[board-filter]]", ref("board-filter")).replace("[[tray]]", ref("tray"))))}
  <h2>How the board is laid out</h2>
  <p>With <b>Both sides</b> selected the board splits down the middle by a thin line. Each half has its side’s name in colour (blue, then red). <b>Reserve sits on the outer edge and the Front line next to the dividing line</b>, so the two front lines face each other. Under each column title is a summary: <i>15 units · HP 73.8/80 · ATK 73</i>.</p>
  <p>Selecting one side shows a single board for it, with every column in order. A third panel, <b>Destroyed</b>, collects units at 0 HP from both sides; it folds like any other panel.</p>
  ${note("The committee has one front", "Each topic has a single <i>Front line</i> column, plus the fixed <i>Reserve</i> and <i>Destroyed</i> columns. Extra fronts can be added by delegates; the fixed columns cannot be renamed or removed.")}
  ${warn("You cannot drag cards between columns", "Moving a unit from Reserve to the Front line is the owning delegate’s decision. Chairs can drag a card <i>into the battle tray</i> only. Cards you cannot move simply do not move; nothing is lost.")}`
},

/* 21 */
{ id: "card", part: OB, title: "Reading a unit card",
  lead: "Everything you need to know about a unit fits on one small card.",
  body: `
  <div class="g2">
    ${fig("card-full", "A unit at full strength.", { cls: "plain" })}
    ${fig("card-foe", "A weakened British unit: a red edge marks the second side, and the bar has fallen to 11%.", { cls: "plain" })}
  </div>
  ${tbl(["Part", "Meaning"], [
    [ui("Code chip"), "A short code for the unit’s sub class: <code>INF</code> infantry, <code>HOB</code> hobelars, <code>COG</code> cog, <code>ART</code> artillery and so on. The chip takes its class colour (Army olive, Navy indigo, Airforce teal, Marine orange)."],
    [ui("Name"), "The name the delegate gave it, such as <i>Infantry 4</i>."],
    [ui("HP bar"), "HP left as a share of full HP, coloured by readiness tier: green when healthy, shading through amber and orange to red ([[ov-ready]])."],
    [ui("HP 7/7"), "Hit points now, over the unit’s full hit points."],
    [ui("STR 100%"), "Strength: the same share as the bar. A destroyed unit shows a dash."],
    [ui("ATK 5"), "Attack. When a rule changes it, the new value is bold and the card’s printed value is struck through, for example <b>ATK 1</b> <s>5</s> for a unit at 11% strength under the default strength penalty."],
    [ui("MOV 5"), "Movement: how far the unit can travel in a turn. On the map, 1 MOV is about 30 km on open ground ([[map-troop]])."]
  ].map(r => r.map(c => c.replace("[[ov-ready]]", ref("ov-ready")).replace("[[map-troop]]", ref("map-troop")))), "box")}
  <h2>The buttons on a card</h2>
  <p>Delegates see <b>−1</b>, <b>+1</b> and a sword button. For chairs the HP buttons are greyed out: HP is the delegate’s record. The <b>sword</b> button adds the unit to the battle tray ([[tray]]). Click anywhere else on a card to open its details ([[drawer]]).</p>
  ${tip("Why a bar can be red while ATK is crossed out", "The default <b>Strength penalty</b> lowers ATK as HP falls (a unit under 10% cannot attack at all). The card always shows the effective figure so you do not have to calculate it.")}`
},

/* 22 */
{ id: "board-filter", part: OB, title: "Search, filters and neutral units",
  lead: "On a busy board you will want just one kind of unit, or one name.",
  body: `
  ${fig("board-toolbar", "The toolbar above the board: search, class chips and (greyed out) Add front.")}
  ${steps([
    ["Search", "Type in <b>Search units</b>. The board filters live by unit name, sub class name and code. Typing <code>cog</code> or <code>COG</code> finds Cogs."],
    ["Filter by class", "Press a class chip (<b>Army</b>, <b>Navy</b>, and in Topic 2 <b>Airforce</b> and <b>Marine</b>) to show that class only. Press it again to clear the filter."],
    ["Pick a side", "Use the switch above the toolbar to look at the French Army only, the British Army only, or both."]
  ])}
  ${note("Filters affect what you see, not what exists", "Column totals under each heading count only the cards currently shown. Clear the search and chips to see true totals.")}
  <h2>Neutral parties</h2>
  <p>Some characters begin the committee without a side. Their units are <b>neutral</b>: they are not part of either army and are not in the Overview totals. When any exist, a <b>Neutral parties</b> panel appears on the board with a note, <i>“they pick a side later”</i>. Once you move that character onto a side in <b>Sides by day</b> ([[sides]]), their units join that side’s columns the next time the page refreshes.</p>
  <h2>Where do the units come from?</h2>
  <p>Chairs do not add units. Each delegate adds theirs on their own <b>My Forces</b> page, and SENTINEL copies them to the server a moment after every change. Your board is rebuilt from those copies. If a delegate’s units are missing:</p>
  <ul>
    <li>They may not have added any yet.</li>
    <li>They may be signed in on a new browser that has not sent anything (an empty list from a brand-new device is deliberately <i>not</i> sent, so it cannot wipe what you see).</li>
    <li>Their character may not be on a side today ([[sides-run]]).</li>
  </ul>
  ${tip("Add front is greyed out", "Fronts are structure, and structure belongs to the people entering the forces. Ask the delegates if you need another column.")}`
},

/* 23 */
{ id: "drawer", part: OB, title: "Opening a unit",
  lead: "Click a card for the full record. As a chair you can read everything, and send the unit to the calculator.",
  body: `
  ${fig("drawer", "The unit drawer slides in from the right. Fields are read-only for chairs; HP buttons are greyed.", { marks: [[1, 65.2, 3], [2, 65.5, 27], [3, 65.5, 38.8], [4, 65.7, 87.6]] })}
  ${legend([
    "<b>Heading.</b> Side, name, sub class, class and where it stands. Press ✕ or <kbd>Esc</kbd> to close.",
    "<b>Hit points.</b> HP over full HP, strength percentage and tier, with the bar.",
    "<b>The record.</b> Name, side, front, sub class, class, HP, attack, movement and range, plus <i>Attack in combat</i>: ATK after the rules.",
    "<b>Attack with it / Defend with it.</b> Put the unit in the calculator."
  ])}
  <h2>What you can do in the drawer</h2>
  ${tbl(["Control", "Chair"], [
    ["Edit name, side, front, sub class, stats", "Greyed out"],
    ["−5, −1, +1, +5 HP, Full HP, Destroyed", "Greyed out"],
    ["Duplicate, Remove", "Greyed out"],
    ["<b>Attack with it</b>, <b>Defend with it</b>", "<b>Available</b>: adds the unit to the attack or defence side of the battle tray"]
  ], "box")}
  <p><b>Attack in combat</b> is worth reading before you rule: it is the number the calculator will use, after the strength rules and any side directive. <i>“no strength rule applies”</i> appears when none changes it.</p>
  ${note("Why the HP buttons are off", "A unit’s HP is the delegate’s running record. Changes you rule on happen through <b>Apply</b> in the Combat Calculator ([[calc-apply]]), which logs them and can be undone.".replace("[[calc-apply]]", ref("calc-apply")))}`
},

/* 24 */
{ id: "tray", part: OB, title: "The quick combat calculation tray",
  lead: "Set up an engagement straight from the board, then open the calculator with the units already ticked.",
  body: `
  ${fig("board-tray", "The tray: attackers on the left, defenders on the right, with a live damage estimate.")}
  ${steps([
    ["Drag attackers into the left box", "Drag a card into <b>Attacking</b>, or press the sword button on the card, or use <b>Attack with it</b> in the drawer. On a tablet, press and hold a card, then drag."],
    ["Drag defenders into the right box", "The right box takes the <b>opposite</b> side. If you drop a British unit as the attacker, the tray flips so the British attack and the French defend."],
    ["Read the estimate", "Once each box has a unit the tray shows <b>Estimated damage</b> and the percentage of the defenders’ HP."],
    ["Open the calculator", "Press <b>Open calculator</b>. The units are already ticked ([[calc-pick]])."]
  ].map(x => [x[0], x[1].replace("[[calc-pick]]", ref("calc-pick"))]))}
  <div class="g2">
    ${cd("Remove a unit", `<p>Press the ✕ on its chip. Destroyed units cannot be added: SENTINEL says so in a message instead.</p>`, "w")}
    ${cd("The same engagement everywhere", `<p>The tray, the calculator and the Battle Map’s <b>Open in calculator</b> button share one engagement. Set it up anywhere and finish anywhere.</p>`, "w")}
  </div>
  ${tip("Use the tray for a first look", "The tray’s estimate uses the same rules and the same morale as the calculator. Use it to judge whether a fight is worth setting up in full; use the calculator to see the working, change conditions and apply.")}
  ${note("Nothing changes yet", "The tray, like the calculator, is read-only until you press <b>Apply</b> on the Combat Calculator page.")}`
}
];
