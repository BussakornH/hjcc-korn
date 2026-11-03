"use strict";
const { fig, legend, tip, note, warn, steps, tbl, cd, ui, kbd, cols, Y, N, ref } = require("./lib");
const I = "Introduction", W = "Welcome", G = "Getting started";

module.exports = [
/* 3 ------------------------------------------------------------------ */
{ id: "about", part: I, title: "About this manual",
  lead: "Everything a chair needs to run a Historical Joint Crisis Committee on SENTINEL, in the order you will meet it.",
  body: `
  <p>SENTINEL is the web platform that holds your committee’s forces, map, morale and combat rules. Delegates keep their own forces. <b>You, the chair, see both sides, decide the outcomes and keep the board honest.</b> This manual covers every screen a chair can open and every control on it.</p>
  ${cols(3, [
    cd("New to SENTINEL?", `<p>Read <i>Welcome</i> and <i>Getting started</i> (pages {{p:glance}}–{{p:topbar}}), then follow the one-page session plan on ${ref("session")}.</p>`),
    cd("Mid-session and stuck?", `<p>Jump to <i>Troubleshooting</i> on ${ref("faq")} or the checklist on ${ref("checklist")}.</p>`),
    cd("Setting up rules?", `<p>The <i>Rules &amp; Formulas</i> chapter starts on ${ref("rules")}.</p>`)
  ])}
  <h2>How to read it</h2>
  <div class="g2">
    <div>
      <p>Names of buttons, tabs and pages are in bold, exactly as they appear on screen: ${ui("Order of Battle")}, ${ui("Apply result to both sides")}. Keys look like ${kbd("Ctrl")} ${kbd("Z")}. On a Mac, use ${kbd("⌘")} where the manual says ${kbd("Ctrl")}.</p>
      <p>Screenshots come from <b>Topic 1, The Hundred Years’ War</b>, with sample forces. Your numbers and unit names will differ. Side names change by topic and are given in full on ${ref("glance")}.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:2.4mm">
      ${tip("Tip", "A shortcut or a better way to do the same thing.")}
      ${note("Note", "Something worth knowing that is not obvious from the screen.")}
      ${warn("Important", "An action that cannot easily be undone, or a limit that can surprise you.")}
    </div>
  </div>
  <h2>Quick find</h2>
  ${tbl(["I want to…", "Go to"], [
    ["Sign in or fix a sign-in problem", `${ref("signin")} · ${ref("signin-err")}`],
    ["See how strong each side is", `${ref("ov")}`],
    ["Change a side’s morale", `${ref("morale")}`],
    ["Place troops and draw battle lines", `${ref("map-place")} · ${ref("map-lines")}`],
    ["Work out and apply a battle", `${ref("calc")}`],
    ["Change how damage is calculated", `${ref("rules")}`],
    ["Move a character to another side", `${ref("sides")}`]
  ], "box")}
  <p class="sm" style="margin-top:auto">Describes SENTINEL as of November 2026. If a screen looks different, the platform has been updated; the ideas stay the same.</p>`
},

/* 4 ------------------------------------------------------------------ */
{ id: "glance", part: W, title: "SENTINEL at a glance",
  lead: "One live board for the whole committee: two sides, one map, one set of rules that you control.",
  body: `
  <p>SENTINEL replaces spreadsheets and paper trackers in a Historical Joint Crisis Committee (HJCC). Each delegate plays a character and records their own forces. You see everything, set morale, move the lines on the map and run the combat. Every change you make is logged, and most can be undone.</p>
  ${fig("topics", "The topic picker. A chair chooses one of the committee’s two topics after signing in.", { cls: "crop", h: "62mm" })}
  <h2>The two topics</h2>
  ${tbl(["", "Topic 1", "Topic 2"], [
    ["Conflict", "The Hundred Years’ War, 1337–1453", "The First World War, 1914–1918"],
    ["Side names in the tracker", "French Army · British Army", "Allied Powers · Central Powers"],
    ["Side names on Sides by day", "French royals · English royals · Neutral", "Allied powers · Central powers · Neutral"],
    ["Classes of force", "Army, Navy", "Army, Navy, Airforce, Marine"],
    ["Starting battle lines", "Two (Anglo-Burgundian and Guyenne fronts, 1429)", "None: you draw them"],
    ["Characters", "20", "20"]
  ], "box")}
  <h2>The big ideas</h2>
  ${cols(3, [
    cd("Delegates report", `<p>Each delegate adds and updates their own units. You see those units, read-only, the moment they change.</p>`),
    cd("Chairs decide", `<p>You set morale, run combat, apply results and keep the map. The calculator only estimates; <b>you</b> confirm.</p>`),
    cd("Everything is logged", `<p>Moves, HP changes, morale and battles go into an activity log, and ${ui("Undo")} steps back through them.</p>`)
  ])}
  ${note("Each topic is separate", "Forces, morale, rules, battle lines and sides by day belong to one topic. Changing topic does not copy anything across.")}`
},

/* 5 ------------------------------------------------------------------ */
{ id: "roles", part: W, title: "Three roles, three levels of access",
  lead: "What you can change depends on how you signed in. Chairs see the whole board and own the outcomes.",
  body: `
  <p>Every account has one access level. The sign-in screen offers all three; an account only works at its own level.</p>
  ${tbl(["", "Delegate", "Chair (you)", "Administrator"], [
    ["See their own side’s forces", `<span class="c">${Y}</span>`, N, N],
    ["See both sides and the whole board", N, `<span class="c">${Y}</span>`, N],
    ["Add, edit and move units", `<span class="c">${Y}</span>`, N, N],
    ["Set each side’s morale", N, `<span class="c">${Y}</span>`, N],
    ["Use the combat calculator and apply results", N, `<span class="c">${Y}</span>`, N],
    ["Place troops, draw battle lines, give cities to a side", N, `<span class="c">${Y}</span>`, N],
    ["Edit rules, formulas, classes and sub classes", N, `<span class="c">${Y}</span>`, `<span class="c">${Y}</span>`],
    ["Move characters between sides each day", N, `<span class="c">${Y}</span>`, `<span class="c">${Y}</span>`],
    ["Create accounts, reset passwords, assign characters", N, N, `<span class="c">${Y}</span>`],
    ["See who is online and how the server is doing", N, N, `<span class="c">${Y}</span>`]
  ], "box")}
  ${cols(3, [
    cd("Delegate", `<div class="k">Plays a side</div><p>Menu: Overview, My Forces, Order of Battle, Battle Overview, Battle Map. Sees only their own side’s morale.</p>`, "w"),
    cd("Chair", `<div class="k">Runs the committee</div><p>Menu: Overview, Order of Battle, Morale, Battle Map, Combat Calculator, Sides by day, Rules &amp; Formulas.</p>`, "w"),
    cd("Administrator", `<div class="k">Owns the system</div><p>Menu: System status, Control Panel, Sides by day, Rules &amp; Formulas. Does not command a side.</p>`, "w")
  ])}
  ${warn("Where chairs are read-only", "You cannot add, edit, move or delete units: delegates own those. Controls for them appear greyed out, with a <b>View only</b> note on the page. This keeps the record each delegate reports separate from the decisions you make.")}
  ${note("A different table may appear in the app", "Some on-screen help text (including the sign-in card for chairs) says chairs can only view. The table above reflects what the software actually allows.")}`
},

/* 6 ------------------------------------------------------------------ */
{ id: "role", part: W, title: "What a chair does",
  lead: "A chair is neutral, like the chair of a United Nations committee: the rules and the record are yours; the sides belong to the delegates.",
  body: `
  <p>SENTINEL reflects this on screen. For you, the two sides carry the <b>names of the topic</b> (French Army and British Army), never “My Force” and “Enemy Force” as delegates see them.</p>
  <h2>Your six jobs</h2>
  ${cols(2, [
    cd("1 · Watch the whole board", `<p>The ${ui("Overview")} and ${ui("Order of Battle")} pages show both sides’ strength, readiness and every unit. Delegates report; you verify.</p><p class="sm">Pages ${"{{p:ov}}"}–${"{{p:tray}}"}</p>`),
    cd("2 · Set morale", `<p>One figure per side, 0–100. It scales damage in combat and each delegate sees only their own side’s figure.</p><p class="sm">Pages ${"{{p:morale}}"}–${"{{p:morale-use}}"}</p>`),
    cd("3 · Keep the map", `<p>Place troops, move them as orders are given, shape battle lines, and give cities to a side. Everyone sees your changes.</p><p class="sm">Pages ${"{{p:map}}"}–${"{{p:map-city}}"}</p>`),
    cd("4 · Resolve combat", `<p>Tick attackers and defenders, read the estimate and the working, and press ${ui("Apply")} once you have ruled.</p><p class="sm">Pages ${"{{p:calc}}"}–${"{{p:calc-apply}}"}</p>`),
    cd("5 · Own the rules", `<p>Switch rules on or off, edit the damage formula, results chart and unit stats, and add standing directives per side.</p><p class="sm">Pages ${"{{p:rules}}"}–${"{{p:rules-more}}"}</p>`),
    cd("6 · Assign sides by day", `<p>Characters can change sides as the crisis unfolds. Move them day by day; delegates see their own side change straight away.</p><p class="sm">Pages ${"{{p:sides}}"}–${"{{p:sides-run}}"}</p>`)
  ])}
  <h2>What stays with delegates and the administrator</h2>
  ${tbl(["Task", "Who does it"], [
    ["Adding, editing, moving or deleting units; changing a unit’s HP", "The delegate who owns the unit"],
    ["Creating accounts, resetting passwords, assigning a character to a delegate", "The administrator"],
    ["Wiping forces, battle lines and sides for everyone (<i>Reset for everyone</i>)", "The administrator"]
  ], "box")}
  ${tip("The calculator estimates; you decide", "The result panel says so itself: <i>“An estimate only: the chairs decide the real outcome. Apply it once they confirm.”</i> Nothing changes on either side until you press Apply, and Undo is always there.")}`
},

/* 7 ------------------------------------------------------------------ */
{ id: "before", part: W, title: "Before you begin",
  lead: "A short list of what you need so the first session starts without a hitch.",
  body: `
  <h2>What you need</h2>
  ${cols(2, [
    cd("An account at chair level", `<p>Your administrator creates it and gives you a username and password. Passwords are at least 10 characters, and common ones are refused. One account per person: sign-in attempts are rate-limited, and the administrator can see who is online.</p>`),
    cd("A current web browser", `<p>A recent version of Chrome, Edge, Safari or Firefox on a laptop or desktop works best. The board and the map are designed for a screen at least 1280 pixels wide. Tablets work too: press and hold a card, then drag.</p>`),
    cd("An internet connection", `<p>Sign-in, morale, sides by day, the map, troops and delegates’ forces are all kept on the server, so SENTINEL needs a connection while you work.</p>`),
    cd("Browser storage switched on", `<p>Your rules, battle record and display preferences are stored in this browser. If storage is blocked or full, the page shows <i>“Not saved: browser storage is blocked or full.”</i></p>`)
  ])}
  <h2>Before the first session</h2>
  <ul class="chk">
    <li>Confirm with the administrator that every delegate has an account <b>and a character</b> for the topic you will run.</li>
    <li>Sign in once and open every page in your menu so you know where things are (${ref("sidebar")}).</li>
    <li>Review ${ui("Rules &amp; Formulas")}. The defaults are placeholders until your committee’s booklet says otherwise (${ref("rules")}).</li>
    <li>Agree with your co-chairs which device holds the rules. Rules are stored per browser (${ref("data")}).</li>
    <li>Decide who starts on which side on Day 1, and adjust ${ui("Sides by day")} if needed (${ref("sides")}).</li>
    <li>Choose Day or Night mode. Night mode is easier on the eyes in a dim committee room (${ref("topbar")}).</li>
  </ul>
  ${warn("Use your own account", "Never share a chair login. Your sign-in is tied to your password, and a password reset ends every session for that account.")}
  ${note("Sessions", "A sign-in lasts 12 hours. Each browser tab keeps its own session, so you can be a chair in one tab and test as a delegate in a private window without affecting either.")}`
},

/* 8 ------------------------------------------------------------------ */
{ id: "session", part: W, title: "A session in one view",
  lead: "The same loop, every day of the committee. Each step has a chapter in this manual.",
  body: `
  <div class="flow">
    <div class="st"><div class="n">1</div><b>Sign in</b><span>Pick Chair access, enter your login.<br>${ref("signin")}</span></div>
    <div class="st"><div class="n">2</div><b>Choose a topic</b><span>Topic 1 or Topic 2.<br>${ref("topic")}</span></div>
    <div class="st"><div class="n">3</div><b>Check the board</b><span>Overview and Order of Battle.<br>${ref("ov")}</span></div>
  </div>
  <div class="flow">
    <div class="st"><div class="n">4</div><b>Set morale</b><span>One figure per side.<br>${ref("morale")}</span></div>
    <div class="st"><div class="n">5</div><b>Run engagements</b><span>Calculator, then Apply.<br>${ref("calc")}</span></div>
    <div class="st"><div class="n">6</div><b>Update the map</b><span>Troops, lines, cities.<br>${ref("map")}</span></div>
  </div>
  <div class="flow">
    <div class="st"><div class="n">7</div><b>Settle sides</b><span>Move characters for the next day.<br>${ref("sides")}</span></div>
    <div class="st"><div class="n">8</div><b>Adjust rules</b><span>If the committee rules otherwise.<br>${ref("rules")}</span></div>
    <div class="st"><div class="n">↻</div><b>Repeat</b><span>Add a day and go again.<br>${ref("sides-run")}</span></div>
  </div>
  <h2>A typical turn, minute by minute</h2>
  ${steps([
    ["Read the room", "Open <b>Overview</b>. Check each side’s strength, what is in reserve and any new losses since you last looked."],
    ["Hear the orders", "Delegates tell you what they want to do. Place or move their troops on the <b>Battle Map</b> as you rule."],
    ["Settle contact", "Where forces meet, open the <b>Combat Calculator</b>, tick the units, adjust conditions, and read the working. Rule, then <b>Apply</b>."],
    ["Tell the committee", "Delegates keep their own running records. After you apply a result, tell them the outcome so their figures match."],
    ["Close the turn", "Nudge morale if events call for it. At the end of a day, <b>Add day</b> on Sides by day and move any characters who changed sides."]
  ])}
  ${tip("Keep one window per task", "Many chairs keep the Battle Map on the projector and the Combat Calculator on their own laptop. Both read the same shared data, so the map updates as you apply results.")}`
},

/* 9 ------------------------------------------------------------------ */
{ id: "signin", part: G, title: "Signing in",
  lead: "SENTINEL checks your password on the server. Choose the right access level first, then enter your login.",
  body: `
  ${fig("signin-chair", "The sign-in card set to Chair access. The strip at the bottom of the card switches the access level.", { win: [8, 72], marks: [[1, 36, 68.3], [2, 38.2, 33.4], [3, 62, 40.3], [4, 46.6, 51]] })}
  ${steps([
    ["Open the site and look at the strip at the bottom of the card", "It shows <b>Delegate access</b>, <b>Chair access</b> or <b>Administrator</b>, with three dots. Press it to move to the next level: Delegate → Chair → Admin → Delegate. Stop on <b>Chair access</b>. The card title changes to <b>Chair Access</b> (1)."],
    ["Enter your username", "Usernames use 2–32 letters, numbers, dots, dashes or underscores, and are not case-sensitive (2)."],
    ["Enter your password", "Press <b>Show</b> to reveal it and <b>Hide</b> to cover it again (3). Nothing is remembered about your password."],
    ["Press Enter", "Press the blue <b>Enter</b> button or the <kbd>Return</kbd> key (4). The button reads <i>Checking…</i> while the server verifies you."]
  ])}
  <div class="g2">
    ${cd("Remember me", `<p>Tick <b>Remember me</b> to keep your <i>username</i> on this device, so next time the cursor starts in the password box. The password is never stored.</p>`, "w")}
    ${cd("Access granted", `<p>A short <i>Access granted</i> sequence plays, then you land on the topic picker. If your device is set to reduce motion, SENTINEL skips the animation and goes straight in.</p>`, "w")}
  </div>
  ${tip("The level is remembered", "SENTINEL remembers the access level you used last on this device, so you normally open straight on Chair access.")}
  <p><b>Signing out.</b> Press ${ui("Sign out")} in the top bar of any page (or on the topic picker). Close shared computers this way: your session lives in the browser tab and also ends when you close it.</p>`
},

/* 10 ----------------------------------------------------------------- */
{ id: "signin-err", part: G, title: "When sign-in goes wrong",
  lead: "Every message tells you what to do next. These are the ones you may see.",
  body: `
  ${fig("signin-error", "After a wrong password the message appears under the form and the password box clears.", { win: [18, 62], marks: [[1, 36.5, 48.4]] })}
  ${tbl(["Message", "What it means", "What to do"], [
    ["<i>That username or password is not right.</i>", "Wrong username or password. Nothing else is revealed.", "Check Caps Lock, press <b>Show</b> to read what you typed, and try again."],
    ["<i>This account does not have chair access. Switch the access level below.</i>", "The login is right, but the strip is set to the wrong level (for example Delegate).", "Press the strip at the bottom of the card until it reads <b>Chair access</b>."],
    ["<i>Too many attempts. Try again in N minutes.</i>", "Sign-in is temporarily locked for safety.", "Wait the time shown. See the limits below."],
    ["<i>Cannot reach the sign-in service. Try again.</i>", "Your device could not reach SENTINEL.", "Check your internet connection and reload."]
  ], "box")}
  <h2>Lock-out limits</h2>
  <p>Limits exist to stop password guessing. A whole room often shares one wifi address, so they are generous. Each lasts <b>15 minutes</b>.</p>
  ${cols(3, [
    cd("40 wrong passwords", `<p>from one address (all accounts together) locks sign-in for that address.</p>`),
    cd("10 wrong passwords", `<p>against one account from one address locks sign-in for that address.</p>`),
    cd("60 wrong passwords", `<p>against one account from all addresses combined locks that account.</p>`)
  ])}
  <h2>Forgotten password</h2>
  <p>Press <b>Forgot password?</b> under the form. It reminds you to ask your committee administrator to reset your account. Only the administrator can do this; there is no self-service reset.</p>
  ${warn("A reset ends every session", "When an administrator resets a password, every existing sign-in for that account stops working. You will be returned to the sign-in screen the next time the page checks your session. Sessions also expire 12 hours after you sign in.")}`
},

/* 11 ----------------------------------------------------------------- */
{ id: "topic", part: G, title: "Choosing a topic",
  lead: "After signing in you pick which of the committee’s two topics to run. Each has its own forces, rules and map.",
  body: `
  ${fig("topics", "Each topic card shows its map, the starting battle lines and the sides. Press Enter topic to open it.", { win: [6, 88], marks: [[1, 21, 36.6], [2, 60, 36.6]] })}
  ${steps([
    ["Read the two cards", "<b>Topic 1</b> is The Hundred Years’ War (1337–1453). <b>Topic 2</b> is The First World War (1914–1918). Each card previews its map and battle lines."],
    ["Press Enter topic", "SENTINEL opens the dashboard on the <b>Overview</b> page for that topic, with a short transition."],
    ["Change topic any time", "Press <b>Change topic</b> at the top of the sidebar. Your work in the other topic is kept exactly as you left it."]
  ])}
  <div class="g2">
    ${cd("What belongs to a topic", `<ul><li>Delegates’ forces and the Order of Battle</li><li>Morale for each side</li><li>The rules and formulas</li><li>Troops on the map, battle lines and city sides</li><li>Sides by day</li></ul>`, "w")}
    ${cd("What does not", `<ul><li>Your account and password</li><li>Your Day / Night choice</li><li>Which panels you collapsed</li></ul><p class="sm" style="margin-top:1.4mm">These stay the same in both topics.</p>`, "w")}
  </div>
  ${note("You can run both", "Two committees can run on the same platform at once. A chair for each topic can work in parallel without touching the other’s data.")}
  ${tip("Lost your place?", "The top bar always shows the page name and your role. The small label above each page heading shows the topic, for example <i>Topic 1 · The Hundred Years’ War (1337)</i>.")}`
},

/* 12 ----------------------------------------------------------------- */
{ id: "workspace", part: G, title: "Your workspace",
  lead: "Every page shares the same frame: a menu on the left, a bar across the top and the page itself in the middle.",
  body: `
  ${fig("overview", "The chair’s workspace on the Overview page.", { marks: [[1, 22, 2.2], [2, 49, 2.2], [3, 57.9, 2.2], [4, 85.6, 2.2], [5, 1.1, 20.6], [6, 21.9, 13.8], [7, 56.4, 24.2], [8, 21.9, 31.4]] })}
  ${legend([
    "<b>Menu button.</b> Opens and closes the sidebar.",
    "<b>Page title and role.</b> You are signed in as Chair.",
    "<b>Actions.</b> Undo, Add units (greyed for chairs) and Sign out.",
    "<b>Day / Night.</b> Switches the colour theme.",
    "<b>Sidebar.</b> Change topic, then the seven pages a chair uses.",
    "<b>View-only note.</b> Appears on pages where units cannot be changed.",
    "<b>Page controls.</b> Switch side, collapse panels and more.",
    "<b>Panels.</b> Each can be folded to show a one-line summary."
  ])}
  <h2>Three things worth knowing</h2>
  ${cols(3, [
    cd("The menu folds", `<p>The sidebar folds away after you open a page to give the content room. Press ${ui("☰")} to bring it back; ${kbd("Esc")} closes it.</p>`),
    cd("Pages remember", `<p>Collapsed panels, the side you were viewing and Day / Night are remembered on this device.</p>`),
    cd("Pages update", `<p>Morale, the map and the delegates’ forces refresh by themselves: morale every 15 seconds, the map as it changes.</p>`)
  ])}
  ${note("Read the footer", "The line at the bottom of each page reminds everyone: <i>“Forces are reported by the delegates; morale and every outcome are set by the chairs.”</i>")}`
},

/* 13 ----------------------------------------------------------------- */
{ id: "sidebar", part: G, title: "The sidebar",
  lead: "Seven pages, one topic switch. This is your whole menu.",
  body: `
  <div class="g-side" style="--w:50mm">
    ${fig("sidebar", "The chair’s sidebar, open.", { cls: "crop" })}
    <div style="display:flex;flex-direction:column;gap:2.6mm">
      ${tbl(["Page", "What you do there"], [
        [`<b>Overview</b><br><small>${"p. {{p:ov}}"}</small>`, "Charts and totals for each side: strength over time, classes, readiness, activity, battles."],
        [`<b>Order of Battle</b><br><small>${"p. {{p:board}}"}</small>`, "Every unit on both sides on one board. Search, filter, and drop units into the battle tray."],
        [`<b>Morale</b><br><small>${"p. {{p:morale}}"}</small>`, "Set each side’s morale from 0 to 100."],
        [`<b>Battle Map</b><br><small>${"p. {{p:map}}"}</small>`, "Place troops, reshape battle lines, give cities to a side."],
        [`<b>Combat Calculator</b><br><small>${"p. {{p:calc}}"}</small>`, "Pick attackers and defenders, read the estimate, then apply the result."],
        [`<b>Sides by day</b><br><small>${"p. {{p:sides}}"}</small>`, "Move characters between the two sides and Neutral for each day."],
        [`<b>Rules &amp; Formulas</b><br><small>${"p. {{p:rules}}"}</small>`, "Control how damage is worked out."]
      ], "box")}
    </div>
  </div>
  <div class="g2">
    ${cd("Change topic", `<p>The pill at the top returns you to the topic picker (${ref("topic")}). Your current page is lost on the way, but nothing is deleted.</p>`, "w")}
    ${cd("Count badges", `<p>The Combat Calculator shows a small number: how many units are currently ticked for the engagement you are setting up.</p>`, "w")}
  </div>
  <div class="co note"><div><b class="t">The footer of the sidebar</b>The two side names for this topic (for example <i>French Army v British Army</i>) and a reminder that delegates report forces while chairs set morale and every outcome.</div></div>
  ${note("Pages you will not see", "<i>My Forces</i>, <i>Battle Overview</i> and <i>Allocation &amp; Data</i> are not in the chair’s menu.")}`
},

/* 14 ----------------------------------------------------------------- */
{ id: "topbar", part: G, title: "The top bar",
  lead: "Undo, sign out and the Day / Night switch are always one press away.",
  body: `
  ${fig("topbar", "The top bar on a chair’s page. Left to right: menu, logo, page name and role, Undo, Add units, Sign out, Day / Night.", { cls: "" })}
  ${tbl(["Control", "What it does"], [
    [ui("☰ Menu"), "Opens and closes the sidebar."],
    ["Page name and role", "The page you are on, with <b>Chair</b> under it. If your username differs from your role it follows, as <i>Chair · yourname</i>."],
    [ui("Undo"), `Reverses your last change on this device: an applied battle, a rule change, a morale change. It is greyed out when there is nothing to undo. Shortcut: ${kbd("Ctrl")} ${kbd("Z")} (${kbd("⌘")} ${kbd("Z")} on a Mac).`],
    [ui("Add units"), "Always greyed out for chairs. Delegates add units; you review them."],
    [ui("Sign out"), "Ends your session and returns to the sign-in screen."],
    [ui("Day / Night"), "Switches the whole interface between a light and a dark theme. The choice is remembered on this device."]
  ], "box")}
  <div class="g2">
    <div>${fig("overview-night", "Night mode on the Overview page. The map and charts adapt too.")}</div>
    <div style="display:flex;flex-direction:column;gap:2.6mm">
      <h3>Keyboard</h3>
      ${tbl(["Keys", "Action"], [
        [`${kbd("Ctrl")} ${kbd("Z")}`, "Undo"],
        [`${kbd("Esc")}`, "Close a pop-up, a unit drawer, a menu or the sidebar; stop placing a troop"],
        [`${kbd("Enter")}`, "Save a pop-up form; apply an edited formula"],
        [`${kbd("Space")} / ${kbd("Enter")}`, "Press a focused panel header or button"]
      ])}
    </div>
  </div>
  ${note("Saving", "Chairs’ settings save as you make them. The usual <i>Saved on this device</i> message stays hidden unless something goes wrong: if browser storage is blocked or full, a red warning appears and you should stop and fix it.")}
  ${note("Presence", "While a page is open, SENTINEL tells the server every 45 seconds that you are there, with your topic and page. The administrator’s System status page uses this to show who is online.")}`
}
];
