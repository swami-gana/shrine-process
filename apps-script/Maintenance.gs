/**
 * One-off roster maintenance for CR03. Run from the Apps Script editor, in this order:
 *
 *   1. auditRoster()                — read-only. Writes the CR-144 report to a "Report" tab.
 *   2. repairRoster()               — gives people who share a Br. No. their own id and merges
 *                                     rows whose names normalise to the same person (CR-141 to CR-145).
 *   3. applyAvailabilityUpdates()   — CR-146 to CR-150: marks the listed people not available and
 *                                     reports every future slot that went back to TBD.
 *
 * Each function writes what it did to the "Report" tab, so the result can be read in the
 * Sheets app on a phone.
 */

const REPORT_SHEET = 'Report';

/** CR-146: exact names only. Row 14 also gets backup = true (CR-148). */
const CR146_NOT_AVAILABLE = [
  'Maa Kunsi', 'Maa Potri', 'Maa Samabuddhi', 'Swami Guruvira', 'Swami Kalaghata',
  'Swami Lavana', 'Swami Nandaka', 'Swami Shantin', 'Swami Rukma', 'Swami Ambara',
  'Swami Dhiraja', 'Swami Vasunanda', 'Maa Gnana', 'Swami Jiva',
];
const CR148_BACKUP = ['Swami Jiva'];

function writeReport(title, lines) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(REPORT_SHEET);
  if (!sheet) sheet = ss.insertSheet(REPORT_SHEET);
  sheet.clearContents();
  const rows = [[title + ' — ' + new Date().toString()]].concat(lines.map(function (l) { return [l]; }));
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  sheet.setColumnWidth(1, 900);
  rows.forEach(function (r) { Logger.log(r[0]); });
}

function peopleRows() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ row: i + 1, values: data[i] });
  }
  return { sheet: sheet, rows: rows };
}

function isTrue(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

function describeRow(r) {
  const v = r.values;
  return 'row ' + r.row + ': id ' + v[0] + ', "' + v[3] + '", available ' + isTrue(v[4]) + ', backup ' + isTrue(v[5]);
}

function slotsHeldBy(personId) {
  return readSlotsRaw()
    .filter(function (s) { return String(s.personId) === String(personId); })
    .map(function (s) { return s.index; })
    .sort(function (a, b) { return a - b; });
}

/** CR-144: report duplicates and junk without changing anything. */
function auditRoster() {
  const people = peopleRows().rows;
  const lines = [];
  const byId = {};
  const byName = {};
  const blank = [];
  let available = 0;

  people.forEach(function (r) {
    const id = String(r.values[0] || '').trim();
    const nameKey = personNameKey(r.values[1], r.values[2]);
    if (!id || !String(r.values[2] || '').trim()) {
      if (r.values.some(function (v) { return v !== '' && v !== null; })) blank.push(r);
      return;
    }
    (byId[id] = byId[id] || []).push(r);
    (byName[nameKey] = byName[nameKey] || []).push(r);
    if (isTrue(r.values[4])) available++;
  });

  const counted = people.length - blank.length;
  lines.push('People rows counted by the app: ' + counted + ' (available ' + available + ', not available ' + (counted - available) + ')');
  lines.push('');

  lines.push('Same name, more than one row (would be merged by repairRoster):');
  let n = 0;
  Object.keys(byName).forEach(function (k) {
    if (byName[k].length < 2) return;
    n++;
    byName[k].forEach(function (r) { lines.push('  ' + describeRow(r)); });
  });
  if (!n) lines.push('  none');
  lines.push('');

  lines.push('Different people sharing one id (the app shows one in place of the other):');
  n = 0;
  Object.keys(byId).forEach(function (id) {
    if (byId[id].length < 2) return;
    n++;
    byId[id].forEach(function (r) { lines.push('  ' + describeRow(r)); });
    const held = slotsHeldBy(id);
    lines.push('    slots with this id: ' + (held.length ? held.map(formatSlotRange).join(', ') : 'none') +
      ' — repairRoster keeps them with the first row');
  });
  if (!n) lines.push('  none');
  lines.push('');

  lines.push('Rows with no id or no name (skipped by the app):');
  if (!blank.length) lines.push('  none');
  blank.forEach(function (r) { lines.push('  row ' + r.row + ': ' + r.values.join(' | ')); });

  writeReport('Roster audit (nothing changed)', lines);
}

/**
 * CR-141 to CR-145. Later rows that share an id with a different person get id + ":" + name.
 * Rows whose names normalise to the same person are merged into the first: contacts kept from
 * either, backup if either is backup, not available if either is not available. Slots and
 * requests that pointed at a removed row are moved to the kept one.
 */
function repairRoster() {
  const p = peopleRows();
  const lines = [];
  const firstByName = {};
  const usedIds = {};
  const remap = {};
  const toDelete = [];

  p.rows.forEach(function (r) {
    const v = r.values;
    const id = String(v[0] || '').trim();
    if (!id || !String(v[2] || '').trim()) return;
    const key = personNameKey(v[1], v[2]);

    const kept = firstByName[key];
    if (kept) {
      const kv = kept.values;
      for (let c = 6; c <= 8; c++) if (!kv[c] && v[c]) kv[c] = v[c];
      kv[4] = isTrue(kv[4]) && isTrue(v[4]);
      kv[5] = isTrue(kv[5]) || isTrue(v[5]);
      p.sheet.getRange(kept.row, 1, 1, kv.length).setValues([kv]);
      if (id !== String(kv[0])) remap[id] = String(kv[0]);
      toDelete.push(r.row);
      lines.push('Merged ' + describeRow(r) + ' into row ' + kept.row);
      return;
    }
    firstByName[key] = r;

    if (usedIds[id]) {
      const newId = id + ':' + String(v[2]).trim();
      p.sheet.getRange(r.row, 1).setValue(newId);
      v[0] = newId;
      lines.push('Gave "' + v[3] + '" its own id ' + newId + ' (was sharing ' + id + ' with "' + usedIds[id] + '")');
      usedIds[newId] = String(v[3]);
      return;
    }
    usedIds[id] = String(v[3]);
  });

  if (Object.keys(remap).length) {
    const slots = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
    const sd = slots.getDataRange().getValues();
    for (let i = 1; i < sd.length; i++) {
      const to = remap[String(sd[i][1])];
      if (to) slots.getRange(i + 1, 2).setValue(to);
    }
    const reqs = requestsSheet();
    const rd = reqs.getDataRange().getValues();
    for (let i = 1; i < rd.length; i++) {
      const to = remap[String(rd[i][1])];
      if (to) reqs.getRange(i + 1, 2).setValue(to);
    }
  }

  toDelete.sort(function (a, b) { return b - a; }).forEach(function (row) { p.sheet.deleteRow(row); });
  if (lines.length) bumpVersion();
  if (!lines.length) lines.push('Nothing to repair.');
  writeReport('Roster repair', lines);
}

/** CR-146 to CR-150. Writes `available` only, empties future slots, reports both. */
function applyAvailabilityUpdates() {
  const p = peopleRows();
  const lines = [];
  const unmatched = [];
  const emptied = [];
  const today = startOfDay(new Date());
  const slotsSheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const slotData = slotsSheet.getDataRange().getValues();

  CR146_NOT_AVAILABLE.forEach(function (name) {
    const key = name.replace(/\s+/g, ' ').trim().toLowerCase();
    const matches = p.rows.filter(function (r) { return personNameKey(r.values[1], r.values[2]) === key; });
    if (matches.length !== 1) {
      unmatched.push(name + (matches.length ? ' (' + matches.length + ' rows — run repairRoster first)' : ' (no exact match)'));
      return;
    }
    const r = matches[0];
    const id = String(r.values[0]);
    const was = isTrue(r.values[4]);
    p.sheet.getRange(r.row, 5).setValue(false);
    if (CR148_BACKUP.indexOf(name) >= 0) p.sheet.getRange(r.row, 6).setValue(true);
    lines.push(name + ': ' + (was ? 'now not available' : 'was already not available'));

    for (let i = 1; i < slotData.length; i++) {
      if (String(slotData[i][1]) !== id) continue;
      const idx = Number(slotData[i][0]);
      if (slotEnd(idx) < today) continue;
      slotsSheet.getRange(i + 1, 2, 1, 6).setValues([['', '', '', '', '', '']]);
      slotData[i][1] = '';
      emptied.push({ index: idx, name: name });
    }
  });

  bumpVersion();
  lines.push('');
  lines.push('Future slots now TBD (CR-150) — refill these:');
  if (!emptied.length) lines.push('  none');
  emptied.sort(function (a, b) { return a.index - b.index; }).forEach(function (e) {
    lines.push('  ' + formatSlotRange(e.index) + ' — was ' + e.name);
  });
  lines.push('');
  lines.push('Not applied (CR-146: exact matches only):');
  if (!unmatched.length) lines.push('  none');
  unmatched.forEach(function (u) { lines.push('  ' + u); });
  writeReport('Availability updates', lines);
}
