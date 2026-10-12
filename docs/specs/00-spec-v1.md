# Shrine Process Coordination — Build Spec v1

Written for an AI coding agent (Cursor). Format adapted from the AI Studio two-part
template: Part 1 gap analysis is already complete (captured in the interview), so this
document is the Part 2 spec, with four sections added that the template does not cover
but this app needs — slot arithmetic, derived-state logic, the template engine, and the
build sequence.

Open points that still need Swami's decision are listed in Section 17 and marked
`[OP-n]` where they appear inline. Everything not marked is decided.

---

## SECTION 1 — ONE-SENTENCE BRIEF

This app helps the Shrine process coordinator to guarantee that the daily shrine
process is never missed, by holding the 3-day slot schedule, tracking each person's
confirmation, kit collection and completion, generating the messages needed to chase
them, and letting Brahmacharis book their own slots from a shared link.

---

## SECTION 2 — PURPOSE & SCOPE

**What it does.** It shows the shrine process schedule as batches of four 3-day slots
and records, per person per slot, three acknowledgements: availability confirmed, kit
collected, process done. It generates ready-to-paste messages with the correct names
and dates already filled in, and copies contact details in one tap. It keeps a list of
all Brahmacharis sorted by how long ago they last did the process, so the coordinator
knows whom to ask next. It exposes a separate self-scheduling view on a shareable link
where Brahmacharis take open slots themselves.

**What it does not do.**
1. It does not send any message automatically. Every message is copied by the
   coordinator and pasted into Gmail, SMS or WhatsApp by hand. The only email the
   system sends is a notification to the coordinator when someone self-books.
2. It does not sync with the existing Google Sheet on an ongoing basis. The sheet is
   read once, at setup, and never again.
3. It does not have user accounts, login or per-person identity. Self-schedulers
   identify themselves by picking their name from a list.

**Who uses it.** One coordinator (plus one optional backup coordinator) on a phone,
several times a week, usually in the middle of doing something else; and roughly 170
Brahmacharis who open a shared link once, take a slot, and never return.

---

## SECTION 3 — PLATFORM & TECH STACK

- **Platform:** Progressive Web App, mobile-first, portrait. Installable to home
  screen. Must work on iOS Safari and Android Chrome.
- **Framework:** React with TypeScript, built with Vite.
- **Styling:** Tailwind CSS.
- **Routing:** two routes only. `/` is the coordinator app. `/book` is the
  self-scheduling view, standalone, with no bottom navigation and no route back into
  `/`.
- **State:** a single client-side store (Zustand or React context — agent's choice)
  holding people, slots and templates. Server is the source of truth; the store is a
  cache with an outbound write queue.
- **Persistence and backend:** Google Apps Script Web App with a Google Sheet as the
  datastore. Reasons: the sheet remains the human-readable archive with no manual
  mirroring, Apps Script sends email natively with `MailApp`, and it costs nothing and
  needs no new accounts. Endpoints:
  - `GET ?action=state` → `{ people, slots, templates, version }`
  - `POST { action: "setAck", slot, field, value }`
  - `POST { action: "assign", slot, personId }`
  - `POST { action: "setAvailability", personId, available }`
  - `POST { action: "setBackup", personId, backup }`
  - `POST { action: "book", slot, personId }` → server-side check that the slot is
    still empty; returns `{ ok: false, reason: "taken" }` if not
  - All mutating handlers wrap their read-modify-write in `LockService.getScriptLock()`
    with a 10-second timeout.
- **Libraries to use:** `vite-plugin-pwa`, `date-fns`, `clsx`. Nothing else without a
  reason.
- **Libraries and patterns to avoid:** no UI component library, no state machine
  library, no date picker (all dates are derived, never entered), no Supabase or
  Firebase, no service worker background sync, no realtime socket layer.

---

## SECTION 4 — CORE USER FLOW

### 4A — Coordinator, the recurring 3-day loop

1. Coordinator opens the app; it lands on the **Schedule** tab scrolled to the batch
   running today.
2. On the day a batch begins, coordinator long-presses the *next* batch's header,
   taps **Copy heads-up message**, pastes it into Gmail, adds the four recipients from
   **Copy email IDs**, and sends.
3. As replies arrive, coordinator taps the 👍 icon on each person's card.
4. Six days before the batch begins, coordinator checks whether all four are ticked.
   For anyone unticked, long-press their card → **Copy availability check** and their
   contact detail → send individually.
5. Three days before the batch begins, anyone still unticked is escalated by phone.
   If unreachable, coordinator long-presses the card → **Replace person** → picks a
   backup from the list.
6. The day before each person's slot, coordinator long-presses that card →
   **Copy kit reminder** → sends on that person's channel.
7. When the person confirms they have the kit, coordinator taps 🔔.
8. When the three days end, coordinator taps 🔥. That writes the completion date and
   updates the person's entry in the **List** tab.
9. Any slot showing TBD is tapped directly → assign someone from the list, or the
   coordinator copies the scheduling link from the **List** tab and sends it to people
   at the top of the **Next up** order.

### 4B — Brahmachari, self-scheduling

1. Receives the `/book` link on WhatsApp or email.
2. Lands on **Schedule Yourself** — months in chronological order, every slot shown,
   taken ones muted with the holder's name, open ones active.
3. Taps an open slot.
4. A full-screen sheet opens: searchable list of all names, no statuses shown.
5. Taps their own name, then **Confirm this slot**.
6. Server accepts → the slot renders as taken with their name, and a confirmation
   line appears. Server rejects because someone took it first → the slot renders as
   taken with the other person's name and the sheet closes with a message telling them
   to pick another.
7. Coordinator receives an email notification.
8. No undo. If they booked in error they contact the coordinator, who fixes it from
   the Schedule tab.

---

## SECTION 5 — SCREENS & LAYOUT

Bottom navigation, coordinator only, three tabs left to right: **List**,
**Schedule** (default on launch), **Schedule Yourself**.

### 5.1 Schedule — screen header "Schedule"

| Region | Contents |
|---|---|
| Header | Title "Schedule". No subtitle. |
| Body | Vertical list of batches, oldest at top, newest at bottom. Scroll position on launch puts the header of the batch containing today at the top of the viewport. |
| Batch header card | Batch date range only, e.g. "12–23 Sep". No slot count, no "12 days" label. Tick mark at right when the batch is complete. |
| Slot cards | Four per batch, attached directly under the header as one visual block. |
| Slot card | Left: person's full name, or "TBD" when unassigned. Under it, smaller: the slot's date range. Right: three icon toggles, hidden entirely when the slot is unassigned. |

- **Primary CTA:** none. This screen is all direct manipulation.
- Icon toggles left to right: 👍 availability confirmed, 🔔 kit collected, 🔥 process
  done. Tapping adds a check badge at bottom-right of the icon; tapping again removes
  it. Never disabled, always reversible, including on past slots.
- Whole batch drops to 45% opacity and shows the tick when all four slots have a
  person and all twelve icons are checked.
- The slot containing today gets a 2px inset stroke.

### 5.2 List — screen header "Brahmachari List (170)"

The bracketed number is the live roster count.

| Region | Contents |
|---|---|
| Header | Title with count. Top-right button: **Copy scheduling link**. |
| Filter row | Three pills: **A–Z** (default), **Next up**, **Backup**. |
| Body | One row per person: full name, and a status line only under Next up and Backup `[OP-74]`. Right side: one tap-target that copies the person's best contact detail, with a badge showing which channel it was. |

- **A–Z:** whole roster alphabetical, names only, no status text.
- **Next up:** available people only, longest-since-done first, everyone never
  recorded as having done it at the top, alphabetical within that group.
- **Backup:** backup-pool members only, longest-since-done first.
- Long-press a row → inline panel: **Mark not available** / **Mark available**, and
  **Add to backup** / **Remove from backup**.

### 5.3 Schedule Yourself — screen header "Schedule Yourself"

No subtitle, no explanatory line, no date-range line. On `/book` there is no bottom
navigation at all.

| Region | Contents |
|---|---|
| Header | Title "Schedule Yourself". Nothing else. |
| Body | Month sections in chronological order from the current month to 12 months ahead. Each section header is the month and year. Slots in a two-column grid. |
| Slot card | Date range as the title. Under it: the holder's name if taken, or "Tap to schedule yourself" if open. |

- Taken cards are muted and not tappable.
- Open cards are visually active and tappable.
- Past slots are not rendered.

### 5.4 Person picker sheet — full screen

Used identically for three jobs: assign to an empty slot, replace the person in a
filled slot, and self-booking.

| Region | Contents |
|---|---|
| Header | Title: "Choose a person" for the coordinator, "Find your name" for self-booking. Under it, the slot's date range. Search input below. |
| Body | Scrolling list of matching names. In the two coordinator modes each row also carries the person's status line, since that is what the choice turns on. In self-booking mode: names only, no status, no last-done, no availability text. |
| Footer | **Cancel**, and **Confirm** / **Confirm this slot**, disabled until a name is selected. |

- Coordinator modes exclude people marked not available. Self-booking mode shows
  everyone, including people marked not available — deliberately ungated.
- Search matches on any part of the name, case-insensitive.

---

## SECTION 6 — INPUT / OUTPUT CONTRACT

| Input | Type | Validation |
|---|---|---|
| Icon toggle | boolean per slot per field | Always permitted. Writes a timestamp when set, clears it when unset. |
| Person selection in picker | personId | Confirm disabled until one is chosen. |
| Search query | string | Free text, no validation, no minimum length. |
| Availability toggle | boolean per person | Always permitted. |
| Backup toggle | boolean per person | Always permitted. |
| Coordinator passcode | string | Checked once against the server, then a token is kept in localStorage. |

**Stored on the server (Google Sheet):** people, slot assignments, the three
acknowledgement timestamps per slot, and the message templates.

**Held only on the device:** language choice, passcode token, scroll position,
unsent writes in the queue.

**Returned in response:**
- Icon tap → the card re-renders in its new colour immediately; if the field is `done`,
  the person's List entry updates in the same frame.
- Copy action → snackbar naming exactly what was copied.
- Assign or replace → card re-renders with the new name and all three icons cleared.
- Self-booking → slot renders as taken, and the coordinator gets an email.

---

## SECTION 7 — DATA MODEL

```ts
type Person = {
  id: string;
  title: "Swami" | "Maa";       // drives the greeting in every template
  name: string;                  // "Mukula" — the part after the title
  fullName: string;              // "Swami Mukula" — what the UI displays
  available: boolean;
  backup: boolean;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  language: "en" | "ta" | null;  // RESERVED. Column exists, is imported if present,
                                 // and is otherwise left null. Nothing in v1 reads it.
  lastDone: string | null;       // ISO date, derived from slots, cached for sorting
};

type Slot = {
  index: number;                 // integer, can be negative; the primary key
  personId: string | null;
  confirmedAt: string | null;    // 👍
  kitAckAt: string | null;       // 🔔
  doneAt: string | null;         // 🔥
};

type Template = {
  id: string;                    // "heads_up" | "availability_check" | "kit_reminder"
  label: string;                 // what the copy action is called in the panel
  scope: "batch" | "person";     // which long-press panel it appears in
  channel: "email" | "message";  // email templates carry a subject and copy as rich text
  subject: Record<Lang, string | null>;
  body: Record<Lang, string>;    // HTML, with {{tokens}}
};
```

Templates live in the datastore, not in the code, because more will be added as the
process runs. Adding a fourth template must mean adding a row, not editing components.

`lastDone` is derived: the latest `slotEnd(index)` across all slots where
`personId === p.id && doneAt !== null`. Recompute on every load and after every 🔥
toggle. Never seeded from the sheet.

---

## SECTION 8 — SLOT ARITHMETIC

- Slot length is 3 days, always. Slot index 0 begins **12 September 2026**.
- `slotStart(i) = ANCHOR + 3i days`; `slotEnd(i) = slotStart(i) + 2 days`.
- A batch is four consecutive slots aligned to the anchor: batch `b` holds slots
  `4b` through `4b+3`. The batch of slot `i` is `Math.floor(i / 4)`.
- Negative indices are valid and represent slots before the anchor. The batch running
  on 10 Sep 2026 is batch −1, slots −4 to −1, 31 Aug – 11 Sep.
- Schedule tab renders from the earliest imported batch through 12 months ahead of
  today, recomputed on load — roughly batch −1 to batch +30 at launch.
- Schedule Yourself renders every slot whose end date is today or later, up to 12
  months ahead.
- A slot belongs to the month of its **start** date. Slots straddling a month boundary
  appear once, in the earlier month, and always show the full range so the grouping
  never has to be interpreted.
- Date display: same month collapses to "12–14 Sep"; crossing months expands to
  "30 Sep – 2 Oct". Inside message templates use the coordinator's own style:
  "Sep 12 - 14" and "Sep 30 - Oct 2".
- All dates are local-date only. No times, no timezone conversion. "Today" is the
  device's local calendar date.

---

## SECTION 9 — DERIVED STATE

### 9.1 Slot card state — first match wins

| # | Condition | State | Fill | Name shown |
|---|---|---|---|---|
| 1 | `personId === null` | TBD | light red | "TBD" |
| 2 | `doneAt !== null` | Done | deeper green | person |
| 3 | `slotEnd < today` | Missed | dark red | person |
| 4 | `kitAckAt !== null` | Kit collected | light green | person |
| 5 | `confirmedAt !== null` | Confirmed | yellow | person |
| 6 | otherwise | Assigned | orange | person |

Consequence, confirmed as intended: unticking 🔥 on a past slot returns it to dark red,
not to light green, because rule 3 outranks rule 4.

### 9.2 Batch state

Complete when all four slots have a person and all three timestamps set. Complete
batches render at 45% opacity with a tick in the header. A batch with three done and
one missed stays at full opacity, showing one dark red card.

### 9.3 Person status line

| Condition | Text |
|---|---|
| `!available` | "Not available" |
| `lastDone === null` | "Yet to do" |
| otherwise | "Last done {n} days ago" |
| `backup` | append " (backup)" to whichever of the above applies |

There is no yearly reset and no "done for the year" concept anywhere in the system.

### 9.4 Neighbour resolution

`prevPerson(i) = slots[i-1].personId`, `nextPerson(i) = slots[i+1].personId`,
resolved across batch boundaries without special-casing. If the neighbour slot is
unassigned or outside the loaded range, the token renders as "TBD".

---

## SECTION 10 — TEMPLATE ENGINE

### 10.1 Tokens

| Token | Resolves to |
|---|---|
| `{{title}}` | "Swami" or "Maa" for the target person |
| `{{name}}` | target person's full name |
| `{{slot_dates}}` | target slot's range, "Sep 12 - 14" |
| `{{batch_dates}}` | batch range |
| `{{prev_person}}` | full name of the person in the previous slot |
| `{{next_person}}` | full name of the person in the next slot |
| `{{schedule_6}}` | six lines: the slot before the batch, the batch's four slots, the slot after. Each line "Sep 9 - 11: Swami Mukula", one per line, unassigned slots as "TBD" |

### 10.2 Rich text copying

Email templates must survive pasting into Gmail with their bold intact. Write both
flavours to the clipboard in one call:

```js
await navigator.clipboard.write([new ClipboardItem({
  "text/html":  new Blob([html],  { type: "text/html" }),
  "text/plain": new Blob([plain], { type: "text/plain" }),
})]);
```

iOS Safari requires the `ClipboardItem` to be constructed synchronously inside the tap
handler; resolve every token before the handler runs, not inside a promise. Fall back
to a hidden `contenteditable` div plus `document.execCommand("copy")` where
`ClipboardItem` is unavailable. Message templates (SMS, WhatsApp) copy as plain text
only.

### 10.3 Template content, English

**`heads_up`** — scope batch, channel email. No subject is copied; the coordinator
types it. Convention: `Shrine Process Reminder — 12–23 Sep`.

```
Namaskaram,

This is a gentle reminder and request for confirmation for <b>your upcoming Shrine
Process</b>.

Please find the schedule and guidelines below:

<b>Schedule:</b>

{{schedule_6}}

<b>Guidelines:</b>

• Ensure to complete the process before 12 PM
• Maintain silence (no need to wear tag)
• Best to walk and not use cycle or e-bike

Collect the kit from the previous person the day before. After your 3 days, pls refill
and hand over to the next person.

<b>Please respond to confirm your availability on those dates</b> 🙏

If you are unavailable on those dates, please find a replacement and let me know at
the earliest.

Pranam
```

**`availability_check`** — scope person, channel message.

```
Namaskaram {{title}},

Just confirming you are available for Shrine process from {{slot_dates}} 🙏
```

**`kit_reminder`** — scope person, channel message.

```
Namaskaram {{title}} 🙏

Gentle reminder that your Shrine Process starts tomorrow. Pls confirm once you
collected the kit from {{prev_person}}.
After your 3 days, pls refill and hand over to {{next_person}} 🙏
```

### 10.4 Tamil — not in v1

Localisation is out of scope for v1 and must not be built. Some Brahmacharis read only
Tamil, so it is coming, but the coordinator has not yet established who needs it.

Prepare for it without building it: keep `subject` and `body` as
`Record<Lang, string>` maps with only the `en` key populated, and keep the reserved
`language` column on `Person`. That way adding Tamil later is content plus a lookup,
not a refactor. Do not add a language toggle, a string table for UI copy, or any
fallback logic in v1.

---

## SECTION 11 — LONG-PRESS INTERACTION

The prototype's long-press failed on most cards. Cause and required behaviour:

- Trigger at **500ms** from `pointerdown`.
- Cancel only if the pointer moves more than **10px** from its origin, not on any
  movement at all. A 1px jitter during a press must not cancel it — this was the bug.
- Cancel on `pointerup` before the threshold, on `pointercancel`, and on a scroll of
  more than 10px.
- Suppress the `click` that follows a fired long-press.
- `preventDefault` on `contextmenu` for pressable cards, and set
  `user-select: none` and `-webkit-touch-callout: none` on them.
- Fire a 10ms haptic via `navigator.vibrate` where available, so the press registers
  before the panel appears.
- The panel opens as an inline block inserted directly beneath the pressed card and
  pushes content down. Only one panel open at a time. It closes on any tap outside it,
  on any action inside it, and on tab change.

**This gesture is the app's single biggest reliability risk and must be tested
exhaustively before M1 is called done.** Long-press is notoriously unreliable in a
PWA, and in the prototype it failed on most cards. Every one of these must work on a
real device, on both iOS Safari and Android Chrome, not just in a desktop browser:

1. Press on a batch header, a slot card and a List row — all three open their panel
2. Press with a slight finger tremor — must still fire
3. Press, then drag well past 10px — must not fire, and must not leave a stuck timer
4. Press immediately after a scroll comes to rest — must fire
5. Press during momentum scrolling — must not fire
6. Press and release at 400ms, then again at 600ms — first does nothing, second fires
7. Press an icon toggle for 600ms — must toggle once, never open a panel
8. Press while a panel is already open elsewhere — closes that one, opens this one
9. Press on an installed home-screen instance, where touch handling differs from the
   browser tab
10. Repeat 20 presses in a row on the same card — all 20 must fire

If a single case fails, fix the gesture before building anything else on top of it.

### 11.1 Batch header panel

1. Copy email IDs — the four addresses of the batch, comma-separated
2. Copy heads-up message — rich text, body only, no subject

No other actions. No replace-all, no bulk assignment.

### 11.2 Slot card panel — assigned slots only

Six items, in three visually separated groups. Group separation is a slightly heavier
divider line only — no group headings, no labels.

*Contact*
1. Copy email
2. Copy phone number — shown greyed and inert as "No phone number on file" when absent
3. Copy WhatsApp number — same treatment when absent

*Messages*
4. Copy availability check
5. Copy kit reminder

*Change*
6. Replace person → opens the picker sheet

Replace person appears here and nowhere else in the app.

### 11.3 List row panel

1. Mark not available / Mark available
2. Add to backup / Remove from backup

---

## SECTION 12 — WRITES, SYNC AND CONFLICTS

- **Coordinator writes are optimistic.** Icon toggles, assign, replace, availability
  and backup changes render immediately and queue for the server. On failure, retry
  with backoff. The queue survives a reload. Safe because the coordinator is the only
  writer on these fields.
- **Self-booking is server-confirmed.** The Confirm button enters a pending state until
  the server responds. Never render a booking optimistically.
- **Reads** refresh on app focus, and every 30 seconds while Schedule Yourself is open,
  so a second person holding the link sees slots fill in.
- **Marking someone not available** clears them from every future slot: `personId` and
  all three timestamps reset to null, slots return to TBD. Past slots are untouched.
  Snackbar reports how many slots reverted.
- **Assign and replace** always clear all three acknowledgements. There is no record
  that the previous holder was ever scheduled there.
- **One-time import.** A CSV is attached to this task in Cursor — reference it directly
  to populate the datastore. Do not ask for the data to be re-entered, and do not
  invent roster entries.
  - Map from the CSV's own headers. Required per person: title (Swami or Maa), name,
    and whichever of email, phone and WhatsApp are present. Optional: an availability
    flag. Extra columns are ignored, not dropped from the sheet.
  - Where a single column holds "Swami Mukula", split the leading title from the name
    and keep both, plus the full string as `fullName`.
  - Import slot assignments through January 2027 (slot indices −4 to 47) if the CSV
    carries them; otherwise those slots start as TBD.
  - **Nothing is imported into `lastDone`, under any circumstances**, even if the CSV
    has a column that looks like it. The existing records are unreliable and every
    person starts with no completion history.
  - This import runs once. After it, the app is authoritative and neither the CSV nor
    the sheet is read again unless the data is rebuilt from scratch.

---

## SECTION 13 — ANIMATIONS & MOTION

Motion only answers a tap. Nothing animates on load, nothing animates on scroll.

| Trigger | What animates | Behaviour | End state |
|---|---|---|---|
| Icon tap | Check badge | Scale 0.6 → 1, 120ms, ease-out | Badge present |
| Long-press fires | Inline panel | Height 0 → auto, 140ms, ease-out; content fades in over the last 80ms | Panel open |
| Panel closes | Inline panel | Reverse, 110ms | Removed |
| Picker sheet opens | Sheet | Translate 100% → 0, 220ms, ease-out; scrim fades to 34% | Sheet open |
| Copy action | Snackbar | Fade and 8px rise, 160ms; holds 2.1s; fades out | Removed |
| Self-booking confirmed | The booked card | Background cross-fades to the taken style over 200ms | Taken |
| Slot claim rejected | The card | Cross-fades to taken with the other person's name | Taken |

Respect `prefers-reduced-motion: reduce` by dropping every transition to 0ms while
keeping all end states.

---

## SECTION 14 — ERROR & EDGE STATES

| Scenario | What the user sees |
|---|---|
| App loading, no cached data | Skeleton batch cards, no spinner |
| App loading, cached data | Cached data immediately, silent refresh behind it |
| Server unreachable, coordinator | Everything still works; a thin bar reads "Offline — 3 changes will sync" |
| Write fails permanently | Bar reads "Couldn't save 1 change" with a Retry action |
| Two people book the same slot | Loser's sheet closes; snackbar "That slot was just taken — please pick another"; the card shows the winner's name |
| Self-booker searches a name that isn't there | "No name matches that. Check the spelling or contact the coordinator." |
| Month with no open slots left | Section still renders, all cards muted. No special message |
| No open slots in the whole 12 months | Above the months: "Every slot is taken. Nothing to schedule right now." |
| Batch with unassigned slots when the heads-up is copied | Those lines read "TBD"; snackbar adds "2 slots still TBD" |
| Kit reminder copied where a neighbour is unassigned | Token renders "TBD"; snackbar adds "Previous person not scheduled" |
| Person has no contact detail at all | Copy tap-target hidden on that row; panel shows all three as inert |
| Slot dates pass with 🔥 unticked | Card turns dark red and stays visible; ticking 🔥 later turns it green |
| Coordinator opens `/` without a valid passcode | Passcode screen: "Enter the coordinator passcode." Wrong entry: "That passcode doesn't match." |
| Self-booker lands on `/` by accident | Same passcode screen. No hint that another view exists |
| Roster is empty (before import) | List tab: "No one on the roster yet. Import the sheet to get started." |
| Someone marked not available who holds future slots | Snackbar "Swami X marked not available · 3 future slots back to TBD" |

---

## SECTION 15 — VISUAL TONE & DESIGN

- **Tone:** quiet, operational. It is a duty roster, not a wellbeing product.
- **Reference:** the density and directness of a good transit or on-call app —
  Linear's mobile list views for restraint, not their palette.
- **Colour:** the six status fills are the entire visual identity and the only saturated
  colour in the app. Everything else is a cool paper neutral. Status ramp, light to
  done: light red `#FADFDB`, orange `#FBE0C0`, yellow `#FAF2BF`, light green `#DCEFD1`,
  deeper green `#A6CCA0`, missed `#DE7C70` with near-black text. Background `#F1F3F1`,
  cards white, text `#191D1B`, secondary `#5C645F`, hairlines `#DDE1DE`, active-slot
  stroke `#1D6A4F`.
- **Typography:** one family. System UI stack, weights 400/550/650, sizes 15/13/11 for
  body, secondary and label. Names at 15 and slot dates at 12, since the name is what
  gets scanned.
- **Do-nots:** no all-caps labels, no gradients, no card shadows, no coloured text as
  a status signal — status lives in the fill, and the fill is the one place colour is
  spent. No icon library beyond the three emoji toggles and the copy glyph. No decorative
  illustration anywhere.

---

## SECTION 16 — COPY & LABELS

**Tabs:** List · Schedule · Schedule Yourself
**Screen headers:** "Schedule" · "Brahmachari List (170)" · "Schedule Yourself"
**Filter pills:** A–Z · Next up · Backup
**List header button:** Copy scheduling link
**Slot card, unassigned:** TBD
**Booking card, open:** Tap to schedule yourself
**Person status:** Not available · Yet to do · Last done {n} days ago · suffix " (backup)"
**Picker sheet titles:** Choose a person · Find your name
**Picker sheet search placeholder:** Search name
**Picker footer:** Cancel · Confirm · Confirm this slot
**Panel labels:** Copy email IDs · Copy heads-up message · Copy email · Copy phone
number · Copy WhatsApp number · Copy availability check · Copy kit reminder · Replace
person · Mark not available · Mark available · Add to backup · Remove from backup
**Inert panel labels:** No phone number on file · No WhatsApp number on file
**Snackbars:** 4 email IDs copied · Heads-up message copied · Email copied · Phone
number copied · WhatsApp number copied · Availability check copied · Kit reminder
copied · Scheduling link copied · Slot updated · acknowledgements cleared · {name}
marked done · Undone · Slot booked · That slot was just taken — please pick another
**Passcode screen:** Enter the coordinator passcode · That passcode doesn't match
**Booking confirmation line:** Booked. {dates} is yours — collect the kit from
{prev_person} the day before.

---

## SECTION 17 — OPEN POINTS

### Resolved

- **Status visibility:** shown in the List tab under every filter, and in the
  coordinator's assign and replace picker. Hidden only in the self-booking picker,
  where Brahmacharis would read "Yet to do" as a claim about them and correct it.
- **Not-available people can self-book.** Ungated by decision.
- **Localisation:** out of v1 (Section 10.4). Structure prepared, nothing built.
- **Email subject:** not copied. Coordinator types it.
- **Slot panel:** six items in three divided groups, no headings.
- **Batch panel:** two copy actions only. Replace lives on slot cards alone.

### Still open

86. **Subject-line identifier.** You need to find these emails again months later.
    Three ways: (a) put the batch range in the subject —
    "Shrine Process Reminder — 12–23 Sep" — which is also the clearest thing for the
    four recipients to see, at the cost of typing five words; (b) leave the subject
    constant and search Gmail by any one recipient's address, which works because
    each batch has a unique set of four recipients and needs no typing at all;
    (c) both — constant subject, and rely on the recipient search. My
    recommendation is (a), because a subject that carries its own dates is also the
    thing that stops a recipient replying to the wrong batch's thread.
87. **"What is the slot time?"** I read this as asking whether the system holds a time
    of day. It does not: every slot is date-only, and the only clock reference anywhere
    is the "complete the process before 12 PM" guideline inside the heads-up template.
    If you meant something else, say which.

---

## SECTION 18 — EXPLICIT EXCLUSIONS

Do not build any of the following in v1:

- Sending messages automatically, scheduled sends, or push notifications
- Ongoing two-way sync with the Google Sheet
- Self-cancellation or self-editing by Brahmacharis
- Adding a new person to the roster from inside the app
- Editing contact details in the app
- Editing message templates in the app (they live in the sheet)
- User accounts, per-person login, or roles beyond the single shared passcode
- Tamil, or any other localisation — no language toggle, no UI string table
- Any "done for the year" or annual-reset logic
- An audit trail of replacements
- Reporting, charts, or export
- Anything beyond the 12-month forward horizon

---

## SECTION 19 — BUILD SEQUENCE

Do not attempt these in one pass. Each milestone ends in something usable.

**M1 — Front end on mock data.** All three tabs, every card state, the six-colour
ramp, long-press panels with the fixed gesture, picker sheet, all copy actions with
tokens resolving against mock data, snackbars, motion. Mock generator: 170 people with
titles and mixed contact channels, batches −1 to +30, assignments through batch 11,
TBD after that, one deliberately missed past slot. No network calls.
*Gate: Swami can drive the whole 3-day loop on a phone without instruction.*

**M2 — Backend.** Apps Script Web App, sheet schema, the one-time import from the
attached CSV, read on focus, optimistic write queue, server-confirmed booking with `LockService`, the
self-booking notification email, the passcode gate, `/book` route with no navigation.
*Gate: two phones holding `/book` cannot both take the same slot.*

**M3 — Finish.** Rich-text clipboard with the Safari fallback, PWA manifest and install
prompt, offline banner and retry.
*Gate: a heads-up message pasted into Gmail keeps its bold, on iOS.*

---

## SECTION 20 — SUCCESS CONDITION

This app is working when the coordinator can, in under a minute and without thinking
about the process, see which of the next eight people has not yet confirmed, copy the
right message with the right names already in it, and record what came back — and when
no slot inside the next three months is sitting at TBD without him knowing about it.
