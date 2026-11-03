"use strict";
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const CC = "Combat Calculator", RF = "Rules & Formulas";
const sw = on => `<span class="sw${on ? "" : " off"}"></span>`;

module.exports = [
/* 35 */
{ id: "calc", part: CC, title: "The Combat Calculator",
  lead: "Work out a fight before you rule on it. Nothing changes until you press Apply.",
  body: `
  ${fig("combat-empty", "The calculator, before any units are ticked.", { cls: "crop", h: "74mm" })}
  <div class="flow">
    <div class="st"><div class="n">1</div><b>Pick the units</b><span>Tick attackers and defenders.<br>[[calc-pick]]</span></div>
    <div class="st"><div class="n">2</div><b>Set conditions</b><span>Morale, multiplier, artillery.<br>[[calc-cond]]</span></div>
    <div class="st"><div class="n">3</div><b>Read the estimate</b><span>Damage, survivors, working.<br>[[calc-result]]</span></div>
    <div class="st"><div class="n">4</div><b>Apply</b><span>Only when you have ruled.<br>[[calc-apply]]</span></div>
  </div>
  <h2>The page at a glance</h2>
  ${tbl(["Area", "What it holds"], [
    ["<b>Attacking</b> (left) and <b>Defending</b> (right)", "A list per side, grouped by front (Reserve, Front line), with a tick box beside every unit still alive."],
    ["<b>Conditions</b> (middle)", "Morale for this engagement, a situational multiplier, a flat bonus when it is switched on, and an artillery option."],
    ["<b>Estimate</b> (below)", "Damage, how many units are destroyed on each side, donuts, a table per unit and the working."],
    ["<b>Battle record</b> (bottom)", "Every battle you have applied, newest first."],
    ["<b>Swap</b> and <b>Clear</b> (top right)", "Swap the roles of attacker and defender, or untick everything."]
  ], "box")}
  <div class="g2">
    ${cd("Rules in use", `<p>The <i>Rules in use</i> chips show which steps are on, such as <i>Morale: ON</i> or <i>Counter-attack: OFF</i>. Press one to switch it; it is the same switch as on the Rules page ([[rules]]).</p>`, "w")}
    ${cd("Everything is reversible", `<p>${ui("Undo")} reverses an applied battle. The estimate itself never touches anyone’s forces.</p>`, "w")}
  </div>
  ${note("Delegates do not have this page", "The calculator is a chair’s tool. Delegates cannot run or apply combat; they report what you rule.")}`
},

/* 36 */
{ id: "calc-pick", part: CC, title: "Choosing the units",
  lead: "Tick who is attacking and who is defending. The attackers are the first side until you swap.",
  body: `
  ${fig("combat-grid", "Three ticked attackers (left) face two ticked defenders (right). The middle panel holds the conditions.", { marks: [[1, 1.8, 3], [2, 31, 3.5], [3, 32, 16], [4, 2, 22]] })}
  ${legend([
    "<b>Role and side.</b> Attacking or Defending, with the side’s name.",
    "<b>Ticked count.</b> How many are ticked, and their combined ATK and HP.",
    "<b>Tick all.</b> Ticks every unit in that group. It becomes <i>Untick all</i>.",
    "<b>A unit row.</b> Name, code, strength, HP, and effective ATK."
  ])}
  ${steps([
    ["Tick the attackers", "In the left list, tick each attacking unit, or press <b>Tick all</b> beside a group such as <i>Front line</i>."],
    ["Tick the defenders", "Do the same in the right list."],
    ["Swap if needed", "If the other side is the one attacking, press <b>Swap attacker and defender</b>. Ticks, morale overrides and the labels move with it."],
    ["Start again", "<b>Clear</b> unticks everyone."]
  ])}
  <h2>What each row shows</h2>
  <p>Each row shows the unit’s name, its code and <b>STR</b> (strength %), a small HP bar with <i>HP/Full HP</i>, and its <b>effective ATK</b>: the number the calculator will actually use. Destroyed units are not listed.</p>
  ${warn("The order of ticking matters", "With the default <b>Focus fire</b> spread, damage lands on defenders <i>in the order you ticked them</i>: the first takes everything it can, and the rest carries over to the next. Tick the unit you want hit first, first ([[rules-more]]).")}
  ${tip("Three ways in", "You can also arrive here with units already ticked: from the Order of Battle’s battle tray ([[tray]]), a unit’s drawer (<b>Attack with it</b> / <b>Defend with it</b>), or a troop on the map (<b>Open in calculator</b>, [[map-troop]]).")}`
},

/* 37 */
{ id: "calc-cond", part: CC, title: "Conditions for this engagement",
  lead: "Adjust what applies to this fight only. None of it changes a side’s real morale or the rules.",
  body: `
  <div class="g-side" style="--w:56mm">
    ${fig("combat-cond", "The Conditions panel with default rules.", { cls: "plain" })}
    <div style="display:flex;flex-direction:column;gap:2.6mm">
      ${tbl(["Control", "Use"], [
        [ui("Attacker morale %"), "A slider and number box, from 0 to 100, starting at the attacking side’s morale. The line below says <i>From French Army</i>. Move it and a link appears: <b>Use French Army morale (50%)</b>. Press it to go back."],
        [ui("Defender morale %"), "Only shown when <b>Counter-attack</b> is on. It scales the defenders’ strike back."],
        [ui("Situational multiplier"), "Type a number, or press a chip: ×0.5, ×0.75, ×1, ×1.25, ×1.5, ×2. Use it for terrain, fortification or surprise. ×1 means no effect."],
        [ui("Flat bonus damage"), "Appears when <b>Flat bonus damage</b> is switched on in the rules. Added after the formula."],
        [ui("Artillery"), "Appears when artillery is in the fight (see below)."],
        [ui("Damage formula"), "The formula in use, for reference. Change it on the Rules page."]
      ], "box")}
    </div>
  </div>
  <h2>Choosing a multiplier</h2>
  <p>The terrain card ([[map-terrain]]) suggests values: attacking across a major river ×0.75, defending a river bank ×1.25, defending mountains ×1.3. <b>These are not applied automatically.</b> Pick the chip that matches your ruling. Terrain, fortification, surprise: <i>“whatever the chairs rule”</i>.</p>
  <h2>Artillery</h2>
  <p>When a unit with the code <code>ART</code> is in the fight, an <b>Artillery in this engagement</b> choice appears:</p>
  ${cols(2, [
    cd("Takes damage", `<p>Artillery is hurt like any other unit. This is the default.</p>`, "w"),
    cd("Only hits", `<p>Artillery deals its damage but takes none: not from a counter-attack, not from a results-chart loss, not when it is the target.</p>`, "w")
  ])}
  ${note("The shore rule", "Troops on land (Army and Marine) <b>cannot damage ships</b>. If a ship is attacked only by land troops, their attack is struck out and the result panel says so: <i>“Shore rule. Troops on land cannot damage ships…”</i> Land troops can still damage hostiles on the shore, and ships can still attack land units.")}`
},

/* 38 */
{ id: "calc-result", part: CC, title: "Reading the result",
  lead: "Once each side has a ticked unit, the estimate appears at once and updates with every change.",
  body: `
  ${fig("combat-result-panel", "The estimate: damage, units destroyed, HP before and after, and the working.", { win: [0, 47], marks: [[1, 1.8, 2.5], [2, 50.3, 2.9], [3, 1.8, 17.9], [4, 26.5, 18.6]] })}
  ${legend([
    "<b>Estimated damage.</b> The headline: 6.5, which is 59.1% of the defenders’ 11 HP.",
    "<b>Destroyed counts.</b> Defenders and attackers destroyed, out of those ticked.",
    "<b>Donuts.</b> HP left on each side: defenders 41%, attackers 100%.",
    "<b>Per-unit table.</b> HP before, HP after, change and a strength bar."
  ])}
  <h2>The headline</h2>
  ${tbl(["Item", "Meaning"], [
    ["<b>Estimated damage · French Army attacks</b>", "Damage dealt to the defenders after every step of the rules, in HP."],
    ["<b>% of the defenders’ HP</b>", "That damage as a share of all the defenders’ HP together."],
    ["<b>Results chart: …</b>", "Shown when the chart is on: the row of the results chart that applied."],
    ["<b>Counter-attack</b>", "Damage the defenders strike back with, when Counter-attack is on."],
    ["<b>Overkill</b>", "Damage left over once every defender is destroyed."]
  ], "box")}
  <h2>The table</h2>
  <p>Each unit has a row: <b>Role</b> (Attacking or Defending), <b>HP before</b>, <b>HP after</b>, <b>Change</b> in red when it lost HP, and a <b>Strength after</b> bar. A unit taken to 0 shows a red <b>Destroyed</b> pill. Artillery set to <i>Only hits</i> shows an <b>Only hits</b> pill.</p>
  ${warn("A custom formula with an error", "If the formula on the Rules page has a mistake, the result panel warns you and uses the standard Attack × Morale formula instead. Fix it on the Rules page ([[rules-formula]]).")}
  ${tip("An estimate, not a verdict", "The panel reads <i>“An estimate only: the chairs decide the real outcome.”</i> If your ruling differs (a surprise, a hero, bad weather), adjust the multiplier, or do not apply and change the unit afterwards through its owner.")}`
},

/* 39 */
{ id: "calc-work", part: CC, title: "Show the working",
  lead: "Every number can be traced. Open the working when a delegate asks why a unit died.",
  body: `
  <p>Press <b>Show the working</b> under the table: each step, with the actual numbers.</p>
  ${fig("combat-working", "The working with default rules. Combined ATK 13, morale 50: damage 6.5.", {})}
  <h2>Reading it, step by step</h2>
  ${steps([
    ["Effective attack", "Each attacker’s ATK, adjusted. Here <i>Infantry 4: ATK 5 at 100% strength = 5</i>. The three attackers add up to <b>13</b>."],
    ["Damage formula", "<code>atk * morale / 100 * mult + bonus</code> with <i>atk = 13, morale = 50, mult = 1, bonus = 0</i> gives <b>6.5</b>."],
    ["Spread over the defenders", "Focus fire: the first defender took all 6.5 (<i>7 → 0.5</i>); the second was untouched (<i>4 → 4</i>)."]
  ])}
  <h2>The same fight with more rules on</h2>
  <p>Switch on the <b>Combat modifier</b>, the <b>Results chart</b> and <b>Counter-attack</b>, and add a +1 French directive, and the working grows to show each one:</p>
  ${fig("combat-working-rules", "Five steps: directive and combat modifier raise each attacker’s ATK; the results chart gives 100% of the damage; both defenders are destroyed, so there is no counter-attack.", {})}
  <ul>
    <li><b>Effective attack</b> now reads <i>ATK 6 … (includes +1 from the French Army directives), +2 combat modifier = 8</i>.</li>
    <li><b>Results chart:</b> 11 damage is 100% of the defenders’ 11 HP → row <i>100% and over</i> → <i>Wiped out</i>.</li>
    <li><b>Counter-attack:</b> <i>“No counter-attack: every defender was destroyed by the hit.”</i> A defender at 0 HP cannot strike back; one with 1 HP left does, at full strength.</li>
  </ul>`
},

/* 40 */
{ id: "calc-apply", part: CC, title: "Applying the result",
  lead: "When you have ruled, one button writes the outcome to both sides.",
  body: `
  ${fig("combat-apply", "The Apply button, with its reminder.", { cls: "plain" })}
  <p>Press <b>Apply result to both sides</b>. SENTINEL works the engagement out again on the live units and then:</p>
  <ul>
    <li>sets each unit’s HP to its new value, in both armies;</li>
    <li>moves units at 0 HP to <b>Destroyed</b> (unless that rule is off);</li>
    <li>adds a line to the activity log and a point to the strength charts;</li>
    <li>adds the engagement to the <b>Battle record</b>;</li>
    <li>unticks any unit that was destroyed;</li>
    <li>updates the HP shown on those units’ markers on the Battle Map.</li>
  </ul>
  <p>A short message confirms: <i>“Battle result applied to both sides”</i>.</p>
  ${fig("combat-record", "The Battle record after one engagement: attackers (+2 more), defenders (+1 more), damage with the counter-attack in brackets, % of their HP and an outcome pill.")}
  ${tbl(["Column", "Reading"], [
    ["Time", "When you applied it."],
    ["Attacking · Defending", "The first unit’s name and <i>+N</i> for others. A dot gives the side’s colour."],
    ["Damage", "Damage dealt, and <i>(counter N)</i> if there was a counter-attack."],
    ["Of their HP", "Damage as a share of the defenders’ HP."],
    ["Outcome", "A pill per side that lost units, such as <b>2 British Army destroyed</b>, or <b>No units lost</b>."]
  ], "box")}
  ${warn("Tell the delegates", "Apply updates <i>your</i> view and the map’s HP. Each delegate’s own tracker is their record, so announce the outcome and let them update their units to match.")}
  ${tip("Made a mistake? Undo", `Press ${ui("Undo")} or ${kbd("Ctrl")} ${kbd("Z")} straight away to step back through applied battles, one at a time. The record keeps up to 300 battles.`)}`
},

/* 41 */
{ id: "rules", part: RF, title: "Rules & Formulas",
  lead: "How damage is worked out, as a short pipeline of steps you can switch on and off.",
  body: `
  ${fig("rules", "The Rules page: a plain-English summary of the current method, then six numbered steps.", { cls: "crop", h: "78mm" })}
  <p>The page opens with <b>Current method</b>, a sentence that restates the rules as they stand, so a committee can read it aloud: <i>“Each unit attacks with its ATK, lowered when it is weakened… The attacking units’ attack is added up and put through <code>atk * morale / 100 * mult + bonus</code>… The damage is spread in the order you tick the defenders… Units at 0 HP move to Destroyed.”</i></p>
  ${tbl(["Step", "Switch", "What it does", "Default"], [
    ["1 · Unit attack", "Always on", "Each unit starts from the ATK on its card.", "—"],
    ["2 · Strength penalty", sw(1), "Weakened units attack with less.", "On"],
    ["3 · Combat modifier", sw(0), "Adds or subtracts ATK by strength tier.", "Off"],
    ["4 · Damage formula", "—", "Turns total attack into damage.", "Attack × Morale"],
    ["5 · Results chart", sw(0), "Looks the damage up as a % of defenders’ HP.", "Off"],
    ["6 · Spread and finish", "—", "How damage is shared; what happens at 0 HP.", "Focus fire"]
  ], "box")}
  <p>The other switches live inside those steps: <b>Morale</b>, <b>Situational multiplier</b> and <b>Flat bonus damage</b> in step 4, and <b>Counter-attack</b> and <b>Move units at 0 HP to Destroyed</b> in step 6. By default Morale, Multiplier and Move-to-Destroyed are on; Bonus and Counter-attack are off.</p>
  ${warn("Rules live in your browser", "Changes apply at once to <i>your</i> Combat Calculator, cards and charts and are written to your activity log. They are stored in this browser and are <b>not</b> pushed to delegates’ browsers. If two chairs run a committee, set the same rules on both devices ([[data]]).")}
  ${note("Each topic has its own rules", "Rules belong to the topic. Setting them for Topic 1 does not change Topic 2. The default strength table follows the NTMUN II booklet; the results chart is a placeholder until your chairs publish theirs.")}`
},

/* 42 */
{ id: "rules-str", part: RF, title: "Strength penalty, modifier and results chart",
  lead: "Three tables that decide how a damaged unit fights and how the result is read.",
  body: `
  <h2>2 · Strength penalty</h2>
  ${fig("rules-step2", "Default rows: below 10% cannot attack; 10–25% −4 ATK; up to 50% −2; up to 75% −1.", { cls: "plain", w: "100mm" })}
  <p><b>Strength</b> is HP left as a share of full HP. The rows are checked from the lowest threshold up and the first match applies. A <b>cannot attack</b> row (<i>below 10%</i>) removes the unit’s attack altogether. Press <b>Add row</b> or <b>Add a “cannot attack” row</b>, <b>✕</b> to remove one, or <b>Restore default</b>.</p>
  <h2>3 · Combat modifier</h2>
  ${fig("rules-step3", "Default modifier rows once switched on: 100% and up +2, 75% +1, 50% 0, 10% −1, 0% −2.", { cls: "plain", w: "100mm" })}
  <p>For booklets that use a <i>modifier by tier</i> instead of a penalty. A unit at 100% gains +2 ATK; one under 10% loses 2. Normally you use <b>either</b> the penalty <b>or</b> the modifier; if both are on, both apply.</p>
  <h2>5 · Results chart</h2>
  ${fig("rules-step5", "Results chart rows (placeholder values) with a Note column.", { cls: "plain", w: "100mm" })}
  <p>Takes the damage as a <b>percentage of the defenders’ HP</b>, finds the row with the highest <i>From %</i> that fits, and applies it: the defenders take <i>N%</i> of the damage, and each attacker loses <i>N%</i> of its HP. Example: 11 damage against 11 HP is 100%, so the row <i>100% and over</i> applies (<i>Wiped out</i>). A hit under 10% falls on the first row: no effect, and the attacker loses 10% of its HP.</p>
  ${warn("The chart is a placeholder", "The values shipped with SENTINEL are not your committee’s. Replace them with your booklet’s before you switch the chart on for real. <b>Restore placeholder chart</b> puts the originals back.")}
  ${tip("Test before you rely on it", "Tick a dummy fight in the calculator and read the working ([[calc-work]]).")}`
},

/* 43 */
{ id: "rules-formula", part: RF, title: "The damage formula",
  lead: "A small, safe formula language. Pick a preset, or write your own.",
  body: `
  ${fig("rules-step4", "Presets, the formula box with its validity message, three terms you can switch off, and the Try it box.", { cls: "plain", w: "100mm" })}
  <p><b>Presets:</b> <i>Attack × Morale</i> (<code>atk * morale / 100 * mult + bonus</code>, the usual crisis method) and <i>Attack only</i> (<code>atk * mult + bonus</code>, for when the chairs take morale out of combat; it also switches the Morale term off).</p>
  <p>Edit the formula freely. Press ${kbd("Enter")} or click away to save. The message below the box reads <i>Formula is valid.</i> or, for a mistake, <i>Problem: Expected “)”. The standard formula is used until this is fixed.</i></p>
  <h2>Names you can use</h2>
  ${tbl(["Name", "Value"], [
    ["<code>atk</code>", "Effective attack of the attacking units, together"],
    ["<code>base</code>", "Their attack before the strength rules"],
    ["<code>morale</code>", "Attacker morale % (100 when Morale is off)"],
    ["<code>mult</code> · <code>bonus</code>", "Situational multiplier (1 when off) · flat bonus (0 when off)"],
    ["<code>hp</code> · <code>maxhp</code>", "Defenders’ current and full HP, together"],
    ["<code>n</code> · <code>m</code>", "Number of attacking · defending units"],
    ["<code>datk</code> · <code>str</code>", "Defenders’ effective attack · attackers’ average strength %"]
  ], "box")}
  <p><b>Operators:</b> <code>+ − * / % ^</code> and comparisons <code>&gt; &lt; &gt;= &lt;= == !=</code> (true counts as 1). <b>Functions:</b> <code>min</code> <code>max</code> <code>round</code> <code>floor</code> <code>ceil</code> <code>abs</code> <code>sqrt</code> <code>pow</code> <code>clamp(x, lo, hi)</code> <code>if(test, a, b)</code>. Dividing by 0 gives 0.</p>
  <h2>Ideas to start from</h2>
  ${tbl(["Idea", "Formula"], [
    ["Defenders hit back through their own attack", "<code>max(0, atk - datk / 2) * morale / 100</code>"],
    ["20% less when the attackers are outnumbered", "<code>atk * morale / 100 * mult * if(n &lt; m, 0.8, 1)</code>"]
  ], "box")}
  ${tip("Try it, without a battle", "Under the formula the <b>Try it</b> box takes <i>atk</i>, <i>morale %</i> and <i>defenders’ hp</i> and shows the result live: <i>“Try it: 6.5 damage = 59.1% of 11 HP”</i>.")}`
},

/* 44 */
{ id: "rules-more", part: RF, title: "Spread, directives, sub classes and classes",
  lead: "The finishing touches: how damage is shared, standing orders per side, and the stats behind every unit type.",
  body: `
  ${fig("rules-step6", "Step 6: spread, rounding, and the Counter-attack and Move-to-Destroyed switches.", { cls: "plain", w: "100mm" })}
  <p><b>Spread:</b> <b>Focus fire</b> (default) lets the first ticked defender take all it can, then the next; <b>Even split</b> shares it equally, leftovers moving on; <b>Proportional</b> shares it in proportion to each defender’s HP. <b>Rounding</b> can be none (default), nearest, always down or always up.</p>
  <p><b>Counter-attack</b> makes every defender still standing after the hit strike back at full strength with the same formula (using its morale, no multiplier or bonus). <b>Move units at 0 HP to Destroyed</b> keeps the board tidy; when off, a unit at 0 HP stays where it is but counts as lost.</p>
  <h2>Directives by side</h2>
  ${fig("rules-panel1", "A directive: +1 ATK to all units of the French Army.", { cls: "plain", w: "100mm" })}
  <p>Standing orders for <b>one side only</b>: <i>+2 ATK to its standard infantry for a new rifle</i>. Choose the side at the top, press <b>Add directive</b>, pick who it applies to (all units, a whole class, or one sub class), the ATK change and a note. Directives add to the ATK on the card in every battle, and the working shows them.</p>
  <h2>Sub classes and classes</h2>
  ${fig("rules-panel2", "The sub class table: code, name, class and the four stats.", { cls: "crop", h: "42mm" })}
  <p>Each <b>sub class</b> has a code (up to 8 characters), a name, a class, and <b>ATK, HP, MOV, RNG</b>. Rows from the starting set are tagged <b>PLACEHOLDER</b> until your booklet’s values replace them. <b>Add sub class</b> creates one; <b>Update units</b> pushes new stats to units of that type held on this device, keeping each unit’s share of HP; <b>Restore placeholder stats</b> undoes your edits. Delegates enter their own units with their own stats; a change here affects only your device. <b>Classes</b> (Army, Navy, Airforce, Marine) can be renamed and recoloured, and removed only when no unit uses them.</p>`
}
];
