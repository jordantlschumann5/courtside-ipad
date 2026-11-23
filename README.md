# Courtside — offline game-day tracker

## Open Courtside

**Use this link on any phone, tablet, or computer:** [https://jordantlschumann5.github.io/courtside-ipad/](https://jordantlschumann5.github.io/courtside-ipad/)

Every GitHub release post should start with a clickable **Open Courtside** link. Use `https://jordantlschumann5.github.io/courtside-ipad/?release=TAG` with that release's tag, so the link can load the update even when an older copy of the app is saved offline.

You can also use **Copy access link** on the start screen. Game data stays in the browser on the device where it was entered. To move a game between devices, export its JSON backup on one device and import it on the other.

Courtside is a separate, one-iPad app. It has no connection to either EIU practice-stat site. It keeps game data in the iPad's browser storage and requires no Wi-Fi during a game.

## Game-day flow

1. Create a game. Both team rosters and playbooks start **blank**, including Drag, Transition, and Extra actions. Nothing is copied from an earlier game.
2. Tap **Setup file** to edit in the app, save a reusable setup profile, import/export a setup profile as JSON, or use the optional CSV workflow. Profiles contain team names, rosters, sections, plays, result definitions, and layout preferences, but no game entries. A ready-to-edit `game-setup-template.csv` is also in this package. If a team has no player/play rows, its roster/playbook stays blank.
3. Review the team counts before applying the file. Applying a new setup replaces the rosters/playbooks, but never erases previously recorded entries. Matching player names retain their identity and per-player FT/foul totals. Keep a JSON backup before changing an in-progress game's roster.
4. On the board, both full rosters (up to 15 players each) are visible. Tap a player for personal fouls and free throws. Team fouls and FTs are derived from players; timeouts are team inputs.
5. Select the team running a play, then one of three section tabs. Categories and their plays are all shown in the chosen section. Tap a play to choose one of the twelve results. Drag and Transition go directly to those results. Extra opens a short text box instead and is tracked as an identifiable note.
6. **Shot tracker** in the header opens separate team pages with Gold, Silver, and Bronze counters. Changes are saved locally as events, so they appear in Entries, can be undone, and are included in game backups.
7. **Entries** in the header opens a separate, filterable history page; Extra notes have a distinct list. Export a JSON backup after each game and store it outside the iPad.
8. **Overview** in the header shows every current play and direct action, grouped by team and section. Search for a play, filter by section or quarter, or show only recorded plays. Each row shows calls, success rate, and points; tap it for counts of each selected result. The totals strip shows made/missed shots, turnovers, fouls, and other results for the selected team and quarter. A custom result can keep its own label and count toward a summary such as Turnovers. Recorded plays removed from a later setup sheet remain available as past plays.
9. **Edit layout** opens a dedicated editor page. Arrange the board, team cards, team stats, player cells, play sections, categories, plays, result buttons, shot tracker, and Overview cells. Use separate 2–12-column grids for each area and device, drag or resize cells, edit exact row/column/width/height values, and use **Edit inside** to reach nested cells. Changes are saved with that game without changing rosters or recorded entries.

The success rate counts whichever result types are checked under **Success rules**. No shooter/assister is captured for play results. Play results do not automatically add points or free throws to a scoreboard; this app intentionally has no score display. Quarters and timestamps are saved with events. Undo voids the latest event without deleting its audit record.

## Setup CSV format

The current download uses this column order:

```csv
kind,team,section,category,play,number,name,outcome,short,points,success,result_id,enabled,action_id,counts_as
```

Use `home` for Team A and `away` for Team B. Examples:

```csv
team,home,,,,,Blue
team,away,,,,,White
section,home,1,Point sets,,,
section,home,2,Specials,,,
section,home,3,Situations,,,
player,home,,,,12,Ava
player,away,,,,4,Lana
category,home,1,Point Sets,,,
play,home,1,Point Sets,Rub,,
action,home,2,Drag,,,,,,,,,,drag
action,home,2,Transition,,,,,,,,,,transition
action,home,3,Extra,,,,,,,,,,extra
outcome,home,,,,,,2-point make · solo,2 Make · Solo,2,true,2_make_solo,true,,two_make
```

`category` creates a group even if it has no plays; `play` adds a button inside that group. `kind` is authoritative: a row with `category` and the name `Drag` creates a category, while a row with `action` creates a direct result button. Thus a category and an action may even share a label. Actions can use any name; the action ID preserves its identity when editing the downloaded CSV. The action ID `extra` opens the custom text-entry dialog; other actions open result selection.

Section numbers 1–8 are supported. Team, section, category, play, player, action, and result rows can appear in any order. Existing seven-column setup files remain supported. Header names are case/spacing-insensitive and common variants are accepted, including `type`/`row type`, `side`, `section number`, `category name`/`group`, `play name`, `jersey number`/`player number`, and `player name`. Column order can vary. Comma, semicolon, and tab-delimited files are accepted, along with UTF-8/UTF-16 text exports. If a player has a jersey number but no name, the app displays the number instead. Roster size remains capped at 15 per team.

`outcome` rows allow result buttons to be renamed, assigned a short button label and points, shown/hidden, assigned an Overview output group, and included in the success rate. `counts_as` can be `two_make`, `two_miss`, `three_make`, `three_miss`, `turnover`, `foul`, or `other`. For example, a result labeled **Out of bounds** can count as `turnover`; Entries show the selected result label and Overview includes it in the turnover totals. `result_id` keeps saved event meanings stable when the visible label changes. Hidden result definitions stay in the game for historical results. If an imported file leaves out result rows, existing result settings are preserved. Applying an import replaces the setup, but never removes recorded events. After import, team names can also be changed using **Edit team & roster** on the board. Team A and B each have independent rosters, sections, categories, plays, and actions.

Use CSV rather than `.xlsx` because the offline iPad app has no spreadsheet parser dependency. Excel and Numbers can both edit/export the CSV. If a setup file omits all rows for one team, that team's name stays as entered when creating the game while its roster/playbook remain blank.

## Install and verify offline

The `dist` folder is a static Progressive Web App. It needs a **stable HTTPS URL for initial installation**; an ordinary local file or insecure LAN URL cannot install its service worker on an iPad. The host only sends the app files. Game data is never uploaded.

1. Place `dist` on a separate static HTTPS host. Do not put it inside the existing practice-stat sites. Keep the URL stable, since switching domains creates a different local storage area.
2. While online, open the URL in iPad Safari, use **Share → Add to Home Screen**, then open the new Home Screen icon once.
3. Create a test game, import a setup CSV, record a play, FT, and Extra note. Turn on Airplane Mode, force-close/reopen the Home Screen app, and confirm the board and Entries still work. Rehearse this **before** a live game.
4. Export a JSON backup after every game, saving it in Files or elsewhere outside the app. The More menu also exports a CSV event log. Importing a JSON backup creates another game and does not overwrite an existing one.

iPadOS may evict website storage under pressure or when site data is cleared. Offline storage is **not a substitute for backups**. There is no cross-device sync in this edition. The iPad hardware installation and Airplane Mode check still need to be done on the actual target iPad.

## Local preview and tests

From the project folder:

```text
python -m http.server 4180 --directory dist
node --test test/*.test.mjs
```

Open `http://localhost:4180` on the same computer. Localhost can register a service worker for testing; accessing the computer's LAN IP from an iPad still needs HTTPS for installation.

Each game is an independent local document. Every input is an event with an ID, timestamp, quarter, team, and relevant play, player, or Extra text. Totals are derived from non-voided events. Historical event labels survive later roster/play edits. Every save completes in IndexedDB before the UI reports success.
