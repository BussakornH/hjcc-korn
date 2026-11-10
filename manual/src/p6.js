"use strict";
/* Playbook: whole-session recipes that stitch the feature pages together, plus the one-page cheat sheet. */
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const CZ = kbd("Ctrl") + " " + kbd("Z");
const PB = "Playbook", RF = "Reference";

module.exports = [
{ id: "pb-open", part: PB, title: "Opening a session",
  lead: "Ten minutes before the room fills: the setup that saves you from fixing things live.",
  body: `
  ${steps([
    ["Sign in and pick the topic", "Use your own chair account and choose the topic you are running ([[signin]], [[topic]]). Check the header names you as <i>Chair</i>."],
    ["Check who is on which side", "Open <b>Sides by Day</b>. If the committee has moved on a day, press <b>Add day</b> ([[sides-run]]). Neutral characters have no force until you move them."],
    ["Set morale", "Give each side its starting figure on <b>Morale</b> ([[morale]]). Delegates see only their own side’s number."],
    ["Read the rules out", "Open <b>Rules & Formulas</b>. Check the switches and the formula against what you told the room, then read <i>Current method</i> aloud ([[rules]]). Rules are shared, so agree with your co-chair who edits them ([[data]])."],
    ["Look at the board", "Open <b>Order of Battle</b>. If a delegation is missing, they have not added units yet, or their character is Neutral today ([[board-filter]])."],
    ["Set up the map", "Place troops where the committee says they stand ([[map-place]]), check the battle lines ([[map-lines]]) and mark any weak or fortified ground ([[map-points]])."],
    ["Do one dry run", "Tick two units in the calculator and look at the working without pressing <b>Apply</b> ([[calc-work]]). If the damage surprises you, fix the rules now."]
  ])}
  ${tbl(["Before the room fills", "Done?"], [
    ["Signed in as a chair, right topic", "☐"],
    ["Today’s day added in Sides by Day", "☐"],
    ["Both sides’ morale set", "☐"],
    ["Rules read through, one editor agreed", "☐"],
    ["Troops placed, lines and points checked", "☐"],
    ["Dry-run battle gave a sensible number", "☐"]
  ], "box")}
  ${tip("Tell the room the rules once", "Players argue less about a result when they heard the method first. Say the formula, whether the counter-attack is on, and how weak and fortified ground works, before the first battle.")}`
},

{ id: "pb-battle", part: PB, title: "Ruling a battle from start to finish",
  lead: "From “we attack at dawn” to everyone’s HP updated, in the order that avoids mistakes.",
  body: `
  ${steps([
    ["Hear the attack", "Let the delegate say who attacks whom and from where. Check both stacks are on the map if ground matters."],
    ["Set up the engagement", "Drag units into the tray ([[tray]]), or tick them in the calculator ([[calc-pick]]). <b>Tick defenders in the order the damage should fall</b>: Focus fire hits the first one first."],
    ["Rule the conditions", "Choose the <b>Situational multiplier</b> for terrain, surprise or supply ([[calc-cond]]). Terrain suggestions are guidance only ([[map-terrain]]). Weak and fortified points apply by themselves."],
    ["Read the result", "Look at damage, units destroyed and HP before and after ([[calc-result]]). Open the working and read the key steps aloud if anyone doubts it ([[calc-work]])."],
    ["Apply it", "Press <b>Apply result to both sides</b> ([[calc-apply]]). HP, Destroyed units, the log, the charts, the battle record and the map markers all update. A mistake? Press <b>Undo</b> or " + CZ + " straight away."],
    ["Tell the delegates", "Delegates keep their own records, so say the outcome out loud: who lost how much, who was destroyed."],
    ["Move the troops", "If the committee rules a retreat or advance, drag the markers on the map ([[map-troop]])."]
  ])}
  <div class="g2">
    ${cd("Fast path", `<p>Tray → <b>Open calculator</b> → check conditions → <b>Apply</b>. Four moves for a routine fight.</p>`, "w")}
    ${cd("Careful path", `<p>Calculator → open <b>Show the working</b> → rule the conditions → read it aloud → <b>Apply</b>. Use it for decisive battles.</p>`, "w")}
  </div>
  ${warn("Apply writes to both sides", "Nothing changes until you press Apply, and then it changes <i>both</i> armies and the map for everyone. Check the defenders’ order first: reordering after the fact means Undo and starting again.")}`
},

{ id: "pb-side", part: PB, title: "Defections, captures and new loyalties",
  lead: "A character changes side mid-session. Do it in this order and nothing is left pointing at the wrong army.",
  body: `
  ${steps([
    ["Rule the change", "Agree it with your co-chair and announce it. The room should hear <i>why</i>, because the screens only show the result."],
    ["Move the character", "In <b>Sides by Day</b>, drag the character to the new column or to Neutral ([[sides]]). Their units shift on the board, and the delegate’s morale card changes to the new side’s figure."],
    ["Check their troops on the map", "Placed markers stay where they are. Decide whether they stay, retreat or are taken off the map, and check what colour they now show ([[map-troop]])."],
    ["Re-set morale if needed", "A defection usually moves both sides’ morale. Change it on the Morale page ([[morale-use]])."],
    ["Update the ground", "Give captured cities to the new holder ([[map-city]]) and redraw the front if it moved ([[map-lines]])."],
    ["Look at the board again", "Open <b>Order of Battle</b> and check the units now sit where you expect ([[board]])."]
  ])}
  ${tip("Do it between battles", "Change loyalties while no engagement is set up, then rebuild the tray or calculator selection from the board, so you are sure which side each unit is on.")}
  ${note("Only the day you edit changes", "Sides are kept by day. Moving a character on today’s row does not rewrite yesterday’s ([[sides-run]]).")}`
},

{ id: "pb-map", part: PB, title: "Running a front on the map",
  lead: "A short routine for using lines, cities and ground together so the map tells the same story as the room.",
  body: `
  ${steps([
    ["Draw the front once", "Use <b>Draw a line</b> to lay down the front, then <b>Reshape</b> to fix it ([[map-draw]], [[map-lines]]). Use the zone tint if you want each side’s ground visible at a glance."],
    ["Keep cities honest", "Whenever a city changes hands, give it to the new side with the <b>Cities</b> tool ([[map-city]])."],
    ["Mark special ground", "Use <b>Weak / fortified</b> for a ruined wall, an exposed flank, a fortress, a prepared position. Name each point so you remember why it is there ([[map-points]])."],
    ["Check who stands where", "Select a troop to see its reach ([[map-troop]]). A unit has to be placed, with its marker inside the ring, before a point affects it ([[map-points-fx]])."],
    ["Fight on it", "Tray or calculator as usual. Weak and fortified effects show in the working under <i>Spread over the defenders</i> ([[calc-work]])."],
    ["Clean up at the end", "Remove points that no longer apply. <b>Restore defaults</b> resets lines only, so points stay until you remove them ([[map-draw]])."]
  ])}
  ${tbl(["Tool", "Use it to", "Page"], [
    ["Reshape", "Move or bend a line, tint a zone, rename, delete", "[[map-lines]]"],
    ["Draw a line", "Add a front or a perimeter (up to 12 lines)", "[[map-draw]]"],
    ["Cities", "Say who holds a city", "[[map-city]]"],
    ["Weak / fortified", "Mark ground that adds 2 or takes 5 off damage (up to 60 points)", "[[map-points]]"]
  ], "box")}
  ${warn("Only one editor at a time", "Lines save as a whole list. Two chairs reshaping at once can overwrite each other. One of you edits the map; the other watches ([[map-lines]]).")}`
},

{ id: "pb-trouble", part: PB, title: "When something goes wrong live",
  lead: "The six things that actually happen mid-session, and the quickest fix for each.",
  body: `
  ${tbl(["What you see", "Quick fix", "Page"], [
    ["Wrong battle applied", "Press <b>Undo</b> or " + CZ + " at once, then rule it again.", "[[calc-apply]]"],
    ["Damage looks too high or too low", "Open the working and look at the formula, the multiplier and any weak or fortified note. A custom formula with an error falls back to Attack × Morale.", "[[calc-work]], [[rules-formula]]"],
    ["A rule change did not stick", "Someone saved first. Read the rules again and repeat your edit.", "[[rules]]"],
    ["Map is out of date", "Switch page and back, or reload. Failed saves say <i>“Could not save …, try again”</i>.", "[[map-city]]"],
    ["A delegate’s units are missing", "They have not added them, the character is Neutral today, or the units are destroyed.", "[[board-filter]]"],
    ["A delegate cannot see morale", "They see only their own side’s figure. On no side today means no figure.", "[[morale]]"],
    ["Signed out suddenly", "Tokens last 12 hours and stop working if the password is reset. Sign in again.", "[[signin-err]]"]
  ], "box")}
  ${note("Still stuck?", "Check the troubleshooting page for the full list, and tell the administrator what you saw and the time ([[faq]]).")}`
},

{ id: "cheat", part: RF, title: "Cheat sheet",
  lead: "Every number, key and formula you are likely to need, on one page.",
  body: `
  <div class="g2">
    <div>
      <h2>Numbers</h2>
      ${tbl(["", ""], [
        ["Move", "1 MOV ≈ 30 km (open ground)"],
        ["Weak point", "+2 HP lost, if hit"],
        ["Fortified point", "−5 HP lost, if hit"],
        ["New point radius", "50 km (5–1000)"],
        ["Morale", "0–100"],
        ["Morale and rules refresh", "15 s"],
        ["Sign-in lasts", "12 hours"],
        ["Heartbeat (admin view)", "45 s"]
      ], "box")}
      <h2>Limits</h2>
      ${tbl(["", ""], [
        ["Battle lines per map", "12"],
        ["Points per line", "120"],
        ["Weak / fortified points", "60"],
        ["Troops on the map", "200"],
        ["Battle record", "300 battles"],
        ["Line or point name", "40 characters"]
      ], "box")}
    </div>
    <div>
      <h2>Default damage</h2>
      <p><code>atk × morale / 100 × mult + bonus</code></p>
      <p>Strength penalty (default on): below 10% cannot attack; 10–25% −4 ATK; up to 50% −2; up to 75% −1.</p>
      <p>Weak or fortified ground changes the HP lost by a damaged unit whose marker is inside the ring, never below 0 or above its HP before the step.</p>
      <h2>Keys</h2>
      ${tbl(["Keys", "Action"], [
        [kbd("Ctrl") + " " + kbd("Z"), "Undo"],
        [kbd("Esc"), "Close, or stop placing a troop"],
        [kbd("Enter"), "Save a pop-up form or a formula"]
      ], "box")}
      <h2>Find it fast</h2>
      ${tbl(["I need to…", "Page"], [
        ["Set up a session", "[[pb-open]]"],
        ["Rule a battle", "[[pb-battle]]"],
        ["Change someone’s side", "[[pb-side]]"],
        ["Use the map", "[[pb-map]]"],
        ["Fix a live problem", "[[pb-trouble]]"],
        ["Look a word up", "[[glossary]]"]
      ], "box")}
    </div>
  </div>`
}
];
