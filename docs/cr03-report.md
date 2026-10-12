# CR03 — roster audit and availability report

Checked against `src/data/people.csv` and `src/data/slots.csv` (the import source in this
repo). The live sheet may have drifted since; `auditRoster()` in
`apps-script/Maintenance.gs` re-runs the same checks against it.

## Swami Jiva "duplicate" (CR-141)

There is only one Swami Jiva row. **Swami Jiva and Swami Vajrabala share Br. No. 325** — in
the master "BR Names List" tab of BR Process 2026 itself, so it is a data-entry clash at the
source, not something the app introduced. One of the two numbers is probably wrong there.
The sheet import used Br. No. as the person id, so both got id `325`. The app then showed
one person in place of the other, and the "not available" flag on the second row was
really Vajrabala's: his In Ashram cell is blank. A re-import also copied Vajrabala's flags
onto Jiva, because the importer matched existing rows by id.

Fixed:
- The import now gives a second person on a shared Br. No. the id `325:Vajrabala`, the same
  rule the app already used. It also carries flags over by name instead of by id.
- Names are normalised on import (trim, collapse spaces, ignore case, title + name). Rows
  that normalise to the same name are merged into one person, keeping contacts from both
  (CR-142).
- `repairRoster()` applies both fixes to the live sheet. Slots held by `325` stay with
  Swami Jiva. In the source data, Vajrabala holds no slots.

## Roster count, 227 against ~170 (CR-144, OP-122)

No duplicate names and no blank rows in the source. The 227 rows are 227 different people:

| In Ashram | Rows |
|---|---|
| yes | 169 |
| blank | 57 |
| "ssb" | 1 (Swami Guruvira) |

The ~170 you expected matches the 169 marked "yes". The other 58 are imported as
**not available**, so they never appear under Next up or in the person picker. That means
Next up has **not** been wrong. The header simply counts everyone on the roster, available
or not. Nothing was deleted.

## Availability updates (CR-146 to CR-150)

All 14 names match exactly one person on the full roster.

- **CR-146a:** I checked the 119 people outside the not-yet-scheduled list.
  - "Deera" → **Swami Dhiraja**: the nearest outside names are Bekura, Devabahu, Adhura
    and Madhura. None is as close. Applied.
  - "Vasundhara" → **Swami Vasunanda**: the nearest outside name is **Swami Vasuprabha**.
    He is less close, so this is applied. One thing to check: Vasunanda is already "not in
    ashram" in the source, but Vasuprabha is in ashram and available. If you meant
    Vasuprabha, tell me and I'll switch it.
- **Already not available** in the source data (In Ashram blank or "ssb"): Guruvira,
  Lavana, Nandaka, Shantin, Rukma, Ambara, Vasunanda, Gnana.
- **Changed to not available:** Kunsi, Potri, Samabuddhi, Kalaghata, Dhiraja.
- **Swami Jiva** stays **available** (owner's decision, 12 Oct): he is expected to recover
  before his 17–19 Nov slot, which he keeps. He is set to backup = true (CR-148).
- **"Forson"** dropped (owner's decision, 12 Oct).

**Future slots that go back to TBD (CR-150), from the source data:** none.

`applyAvailabilityUpdates()` writes the real list from the live sheet to the `Report` tab.

## OP-124, temporary versus permanent

The `Report` tab lists any slot emptied by these updates, as the record of whose slots to
offer back. Marking someone available again does not restore a slot.

## Slots checked against BR Process 2026 (12 Oct)

All 43 slots from 12 Sep 2026 to 18 Jan 2027 match the app, except **12–14 Sep**: the sheet
says Swami Nabha, the app says Swami Yastir. The app is right (owner, 12 Oct). 8–10 Nov is
empty in both; the owner is giving it to **Maa Dakshina**.
