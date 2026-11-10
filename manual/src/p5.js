"use strict";
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const SD = "Sides by Day", RF = "Reference";

module.exports = [
/* 45 */
{ id: "sides", part: SD, title: "Sides by day",
  lead: "In a crisis, loyalties move. Here you pull each character onto a side, one day at a time.",
  body: `
  ${fig("sides", "Day 1 in Topic 1: seven characters per side or Neutral.", { win: [10, 76], marks: [[1, 2.7, 29.5], [2, 8.6, 29.5], [3, 2.5, 35.6], [4, 3.5, 41.3]] })}
  ${legend([
    "<b>Day.</b> One chip per day. The last day is the current one.",
    "<b>Add day.</b> Start the next day from the day before.",
    "<b>Side columns.</b> French royals, Neutral, English royals (Topic 2: Allied powers, Neutral, Central powers).",
    "<b>Characters.</b> Each chip is a character, with the delegate’s username under it when one is assigned."
  ])}
  ${steps([
    ["Pick the topic and day", "You work in the topic you chose. Press a <b>Day</b> chip to look at that day."],
    ["Move a character", "<b>Drag a chip</b> to another column, or <b>click the chip</b> (it highlights) and press <b>Move here</b> on the column you want. "],
    ["Done", "Saved at once. The delegate holding that character sees their side change <b>straight away</b>."]
  ])}
  <div class="g2">
    ${cd("Day 1 starts from the allocation sheet", `<p>The first day begins with every character on the side their faction belongs to. <b>Add day</b> copies the day before.</p>`, "w")}
    ${cd("Remove last day", `<p><b>Remove last day</b> appears once there are two days or more. It deletes the latest day and its moves, so use it only to undo a day you added by mistake.</p>`, "w")}
  </div>
  ${warn("Only the last day counts", "A delegate’s current side is whatever it is on the <b>last day</b>. You can open and edit earlier days for the record, but doing so does not move anyone today.")}
  ${note("Neutral means no force", "A delegate whose character is Neutral today sees <b>“Neutral today. You have no force on Day N. The chairs decide when you join a side.”</b> Their units appear on your board under <i>Neutral parties</i> ([[board-filter]]).")}`
},

/* 46 */
{ id: "sides-run", part: SD, title: "Running a day",
  lead: "A short routine for each day of the committee, and who starts where.",
  body: `
  ${steps([
    ["Open the day", "At the start of the committee day, press <b>Add day</b> if the committee has moved on. Everyone begins on the side they held yesterday."],
    ["Hear the crisis", "As directives and crisis notes arrive, decide who defects, is captured, or changes loyalty."],
    ["Move the characters", "Drag them to their new column. Announce each move aloud: delegates see their own side change on screen, but the room needs to hear why."],
    ["Check the board", "Open <b>Order of Battle</b>. Moved characters’ units shift to their new side or to <i>Neutral parties</i>."],
    ["Close the day", "When the day ends, leave it as is. The next <b>Add day</b> copies it."]
  ])}
  <h2>Who starts where</h2>
  ${tbl(["", "Topic 1 · The Hundred Years’ War", "Topic 2 · The First World War"], [
    ["<b>First side</b><br><small>7 characters</small>", "<b>French royals.</b> Arnoul d’Audrehem, Arthur de Richemont, Bertrand du Guesclin, Charles of Blois, Duke of Normandy, King Charles VI, King Philips VI.", "<b>Allied powers.</b> Raymond Poincaré, Nicholas II, George V, Joffre, Asquith, Goremykin, Jellicoe."],
    ["<b>Second side</b><br><small>6–7 characters</small>", "<b>English royals.</b> Humphrey of Gloucester, John of Gaunt, King Edward III, Philip the Good, Sir John Chandos, William de la Pole.", "<b>Central powers.</b> Kaiser Wilhelm II, Franz Joseph I, Enver Pasha, Hindenburg, Tisza, Atatürk, Tirpitz."],
    ["<b>Neutral</b><br><small>6–7 characters</small>", "Pope Benedict XII, Charles the Bad, Fr. John Ball, François Prelati, Robin Hood, St Catherine of Siena, St Roch.", "Woodrow Wilson, Queen Wilhelmina, King Gustav V, King Alfonso XIII, Kamio Mitsuomi, Moranville."]
  ], "box")}
  ${tip("Neutral is a starting point, not a trap", "Neutral characters have no force until you move them. When one joins a side, their units arrive on that side’s board and the delegate’s morale card starts to show that side’s figure.")}
  ${note("Names follow the topic", "On this page the sides carry the committee’s own names (French royals, English royals). Elsewhere in the tracker you will see the army names, French Army and British Army, or Allied Powers and Central Powers.")}`
},

/* 47 */
{ id: "checklist", part: RF, title: "Chair’s checklist",
  lead: "Tick these off before, during and after each session. Print this page for the table.",
  body: `
  <div class="g2">
    <div>
      <h2>Before the session</h2>
      <ul class="chk">
        <li>Sign in at <b>Chair access</b> and open both topics.</li>
        <li>Check every delegate has an account and a character.</li>
        <li>Open <b>Sides by day</b> and confirm Day 1.</li>
        <li>Set <b>Morale</b> for both sides (default 50%).</li>
        <li>Review <b>Rules &amp; Formulas</b> against the booklet: strength table, chart, formula.</li>
        <li>Place any starting troops on the <b>Battle Map</b>.</li>
        <li>Choose Day or Night mode for the room.</li>
        <li>Agree which device holds the rules, and who edits the battle lines.</li>
      </ul>
    </div>
    <div>
      <h2>Each turn</h2>
      <ul class="chk">
        <li>Read the <b>Overview</b>: strength, readiness, new losses.</li>
        <li>Rule on orders; update troops on the map.</li>
        <li>For each contact: tick units, set conditions, read the working.</li>
        <li><b>Apply</b> only after you have ruled.</li>
        <li>Announce the outcome to the delegates concerned.</li>
        <li>Adjust <b>Morale</b> if events call for it, and say why.</li>
      </ul>
    </div>
  </div>
  <div class="g2">
    <div>
      <h2>End of day</h2>
      <ul class="chk">
        <li><b>Add day</b> on Sides by day.</li>
        <li>Move characters who changed side.</li>
        <li>Check <b>Neutral parties</b> on the board.</li>
        <li>Review the <b>Battle record</b>.</li>
      </ul>
    </div>
    <div>
      <h2>End of the session</h2>
      <ul class="chk">
        <li>Note any rule changes made in the session.</li>
        <li>Press <b>Sign out</b> on shared computers.</li>
        <li>Remember: the activity log, battle record, strength charts and sub class stats stay in this browser. Rules, morale, sides and the map are on the server.</li>
      </ul>
    </div>
  </div>
  ${tip("Print-friendly", "Choose <b>Day</b> mode before printing any page. The manual itself is built for A4 and prints one page per sheet.")}`
},

/* 48 */
{ id: "data", part: RF, title: "Where your data lives",
  lead: "Some things are shared through the server and others stay in your browser. Knowing which saves a lot of confusion.",
  body: `
  ${tbl(["", "Stored", "Seen by"], [
    ["Delegates’ units (a copy for you)", "Server", "Chairs, read-only"],
    ["Morale, per side and topic", "Server", "Chairs set it; delegates see their own side’s"],
    ["Sides by day", "Server", "Chairs and administrators set it; delegates see their own"],
    ["Troops on the map", "Server", "Everyone"],
    ["Battle lines, city sides, weak and fortified points", "Server", "Everyone"],
    ["Accounts, passwords, characters", "Server (passwords stored hashed)", "Administrator"],
    ["<b>Rules: formula, switches, strength and results tables, directives</b>", "Server (shared per topic)", "Everyone; chairs and administrators edit"],
    ["<b>Sub class stats</b>, activity log, battle record, strength history", "<b>This browser</b>", "You"],
    ["Collapsed panels, side, Day / Night", "This browser", "You"],
    ["Your sign-in", "This browser tab, 12 hours", "You"]
  ], "box")}
  <h2>What that means</h2>
  <ul>
    <li><b>Switching device keeps your rules but starts a fresh log and charts.</b> The shared things (rules, morale, sides, map) come with you. The activity log, battle record, strength history and sub class stats do not.</li>
    <li><b>Clearing site data or using a private window</b> loses your log, battle record, strength history and sub class stats. Rules, morale, sides and map are safe on the server.</li>
    <li>The browser’s data is kept <b>per sign-in</b>: two chairs on one browser never see each other’s log or record.</li>
    <li>Two co-chairs share one set of rules. If you both edit at once, the second save is refused and you are told to check and repeat it. Agree who edits.</li>
    <li>If a delegate’s device is new and empty, it does not wipe the units you can see.</li>
  </ul>
  <div class="g2">
    ${cd("Passwords and sessions", `<p>Passwords are checked on the server and never stored in readable form. A sign-in token lasts 12 hours, lives in the browser tab, and stops working if the password is reset.</p>`, "w")}
    ${cd("Who can see what you do", `<p>The administrator’s System status page lists who is online, with their topic and page, using a heartbeat sent every 45 seconds while a page is open.</p>`, "w")}
  </div>
  ${warn("If saving fails", "A red <i>“Not saved: browser storage is blocked or full”</i> means your log and battle record are not being kept. Free up space or allow storage for this site before you carry on.")}`
},

/* 49 */
{ id: "faq", part: RF, title: "Troubleshooting and questions",
  lead: "The things chairs ask most. Find the symptom, try the fix.",
  body: `
  <div class="g2">
    <div>
      <div class="q"><h3>I can’t see any units.</h3><p>Delegates haven’t added them yet, or their character is not on a side today. Check <b>Neutral parties</b> and Sides by day ([[board-filter]], [[sides]]).</p></div>
      <div class="q"><h3>Add units and the HP buttons are greyed out.</h3><p>That is by design. Delegates own their units. Rule through the calculator and <b>Apply</b> ([[calc-apply]]).</p></div>
      <div class="q"><h3>I can’t drag a card to the front line.</h3><p>Only the owner can. You can drag a card into the <b>battle tray</b> ([[tray]]).</p></div>
      <div class="q"><h3>A delegate says their morale looks wrong.</h3><p>They only see their own side’s figure, refreshed every 15 seconds. If they are on no side today they see none.</p></div>
      <div class="q"><h3>The map isn’t updating.</h3><p>Switch page and back, or reload. You will see <i>“Could not save …, try again”</i> if a save failed ([[map-city]]).</p></div>
      <div class="q"><h3>The strength chart is empty or short.</h3><p>History lives in this browser. A new device or cleared site data starts a new chart ([[data]]).</p></div>
      <div class="q"><h3>My rule change vanished.</h3><p>Someone saved a change to the same topic first, and SENTINEL kept theirs. Read the rules again and repeat your edit ([[rules]]).</p></div>
      <div class="q"><h3>Weak or fortified ground did nothing.</h3><p>The unit must be placed on the map with its marker inside the ring, and it must have lost HP in that step ([[map-points-fx]]).</p></div>
    </div>
    <div>
      <div class="q"><h3>I applied a battle by mistake.</h3><p>Press <b>Undo</b> or <kbd>Ctrl</kbd> <kbd>Z</kbd> straight away ([[calc-apply]]).</p></div>
      <div class="q"><h3>My formula doesn’t work.</h3><p>Read the message under the formula box. Until it is fixed, the standard formula is used and the result panel warns you ([[rules-formula]]).</p></div>
      <div class="q"><h3>Delegates’ numbers differ from mine.</h3><p>Rules are stored in each browser and are not pushed to delegates. Agree the numbers aloud and set your own rules to match the booklet ([[rules]]).</p></div>
      <div class="q"><h3>I was signed out suddenly.</h3><p>Sessions last 12 hours and end when your password is reset. Sign in again.</p></div>
      <div class="q"><h3>Two chairs edited the lines at once.</h3><p>Lines are saved as a whole list, so the later save wins. Decide who edits lines ([[map-lines]]).</p></div>
      <div class="q"><h3>Sign-in says I don’t have chair access.</h3><p>Press the strip at the foot of the card until it reads <b>Chair access</b> ([[signin-err]]).</p></div>
    </div>
  </div>
  ${tip("Still stuck?", "Ask your committee administrator. They can reset your password, check the System status page and see whether your account is online.")}
  ${note("Screen size", "The board and the map are laid out for a wide screen. On a small laptop, zoom the browser out a little (<kbd>Ctrl</kbd> <kbd>−</kbd>) so more of each page fits.")}`
},

/* 50 */
{ id: "glossary", part: RF, title: "Glossary and quick reference",
  lead: "The words SENTINEL uses, in one place.",
  body: `
  <div class="g2">
    <dl class="gl">
      <dt>Active</dt><dd>Units on a front, rather than in Reserve.</dd>
      <dt>ATK</dt><dd>Attack. <i>Effective</i> ATK is after strength rules and directives.</dd>
      <dt>Battle line</dt><dd>A line on the map showing where armies face each other.</dd>
      <dt>Battle tray</dt><dd>The two boxes on the Order of Battle that set up an engagement.</dd>
      <dt>Chair</dt><dd>You. Neutral, sets morale and outcomes.</dd>
      <dt>Character</dt><dd>The historical figure a delegate plays.</dd>
      <dt>Class</dt><dd>A branch of the forces: Army, Navy, Airforce, Marine.</dd>
      <dt>Counter-attack</dt><dd>The defenders striking back in the same engagement.</dd>
      <dt>Delegate</dt><dd>A participant who plays one character and records their forces.</dd>
      <dt>Directive</dt><dd>A standing ATK bonus or penalty for one side.</dd>
      <dt>Focus fire</dt><dd>Damage lands on defenders in the order ticked.</dd>
    </dl>
    <dl class="gl">
      <dt>Front</dt><dd>A column of the Order of Battle. The committee has one: Front line.</dd>
      <dt>HP</dt><dd>Hit points. Strength is HP as a share of full HP.</dd>
      <dt>Morale</dt><dd>A side’s will to fight, 0–100. Scales attacker damage.</dd>
      <dt>MOV</dt><dd>Movement. 1 MOV ≈ 30 km on open ground.</dd>
      <dt>Neutral</dt><dd>On no side today. No force.</dd>
      <dt>Overkill</dt><dd>Damage left over after every defender is destroyed.</dd>
      <dt>Readiness</dt><dd>Units sorted by strength tier.</dd>
      <dt>Reserve</dt><dd>Units raised but not deployed.</dd>
      <dt>RNG</dt><dd>Range of a unit’s attack.</dd>
      <dt>Sub class</dt><dd>A kind of unit in a class: Infantry, Cavalry…</dd>
      <dt>Weak point</dt><dd>A ring on the map: a unit inside it that is hit takes 2 more damage.</dd>
      <dt>Fortified point</dt><dd>A ring on the map: a unit inside it that is hit takes 5 less.</dd>
      <dt>Zone</dt><dd>Tint on one side of a battle line.</dd>
    </dl>
  </div>
  <div class="g2">
    <div>
      <h2>Keys</h2>
      ${tbl(["Keys", "Action"], [
        [`${kbd("Ctrl")} ${kbd("Z")}`, "Undo"],
        [`${kbd("Esc")}`, "Close pop-up, drawer, menu; stop placing a troop"],
        [`${kbd("Enter")}`, "Save a pop-up form or an edited formula"]
      ], "box")}
    </div>
    <div>
      <h2>Limits at a glance</h2>
      ${tbl(["Item", "Limit"], [
        ["Battle lines per map", "12"],
        ["Points per line", "120"],
        ["Weak and fortified points per map", "60"],
        ["Troops on a map", "200"],
        ["Battle record kept", "300"]
      ], "box")}
    </div>
  </div>
  <p class="sm" style="margin-top:auto;text-align:center">SENTINEL · Historical Joint Crisis Committee simulation tool · Fictional. Not affiliated with any real agency or company.</p>`
}
];
