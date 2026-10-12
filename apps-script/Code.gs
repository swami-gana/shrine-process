/**
 * Shrine Process — Google Apps Script Web App
 *
 * Setup:
 * 1. Create a new Google Sheet
 * 2. Extensions → Apps Script → paste this file
 * 3. Run setupSheets() once from the editor
 * 4. Run importFromCsv() once (paste CSV data or use the import menu)
 * 5. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone
 * 6. Set COORDINATOR_EMAIL and PASSCODE in Script Properties
 */

const SHEETS = {
  PEOPLE: 'People',
  SLOTS: 'Slots',
  TEMPLATES: 'Templates',
  REQUESTS: 'Requests',
  META: 'Meta',
};

const SLOT_HEADERS = ['index', 'personId', 'confirmedAt', 'kitAckAt', 'doneAt', 'note', 'noteUpdatedAt'];
const REQUEST_HEADERS = ['id', 'personId', 'slotIndex', 'status', 'createdAt', 'closedAt'];
const NOTE_MAX_LENGTH = 280;

const AVAILABILITY_REQUEST_TEMPLATE = [
  'availability_request', 'Availability request', 'empty_slot', 'message', '',
  'Namaskaram Swami/Maa 🙏\n\nWould you be able to do Shrine process from {{slot_dates}}?', '', '',
];

const PASSCODE_PROP = 'PASSCODE';
const COORDINATOR_EMAIL_PROP = 'COORDINATOR_EMAIL';
const ANCHOR_DATE = new Date(2026, 8, 12); // Sep 12 2026

/** Paste your Google Sheet ID here (from the URL between /d/ and /edit) */
const SPREADSHEET_ID = '1ygj7tbP96ooBmde_iY_3AFqj4GDTp3cYAHXFCPED8FM';

function getSpreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  throw new Error(
    'No spreadsheet found. Open this project via Extensions → Apps Script from your sheet, ' +
    'or set SPREADSHEET_ID at the top of Code.gs.',
  );
}

/** Run this first to confirm the script can see your sheet */
function testConnection() {
  const ss = getSpreadsheet();
  Logger.log('OK — connected to: ' + ss.getName());
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('Existing tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

function setupSheets() {
  const ss = getSpreadsheet();
  Logger.log('Setting up tabs in: ' + ss.getName());

  getOrCreateSheet(ss, SHEETS.PEOPLE, [
    'id', 'title', 'name', 'fullName', 'available', 'backup',
    'email', 'phone', 'whatsapp', 'language', 'neverDone',
  ]);

  getOrCreateSheet(ss, SHEETS.SLOTS, SLOT_HEADERS);
  getOrCreateSheet(ss, SHEETS.REQUESTS, REQUEST_HEADERS);

  getOrCreateSheet(ss, SHEETS.TEMPLATES, [
    'id', 'label', 'scope', 'channel', 'subject_en', 'body_en', 'subject_ta', 'body_ta',
  ]);

  getOrCreateSheet(ss, SHEETS.META, ['key', 'value']);
  setMeta(ss, 'version', '1');

  seedTemplates(ss);

  // Remove blank default tab if we created real tabs
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  Logger.log('Done. Tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setMeta(ss, key, value) {
  const sheet = ss.getSheetByName(SHEETS.META);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getMeta(key) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.META);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function seedTemplates(ss) {
  const sheet = ss.getSheetByName(SHEETS.TEMPLATES);
  if (sheet.getLastRow() > 1) return;

  const templates = [
    ['heads_up', 'Copy heads-up message', 'batch', 'email', '',
      'Namaskaram,\n\nThis is a gentle reminder and request for confirmation for <b>your upcoming Shrine Process</b>.\n\nPlease find the schedule and guidelines below:\n\n<b>Schedule:</b>\n\n{{schedule_6}}\n\n<b>Guidelines:</b>\n\n• Ensure to complete the process before 12 PM\n• Maintain silence (no need to wear tag)\n• Best to walk and not use cycle or e-bike\n\nCollect the kit from the previous person the day before. After your 3 days, pls refill and hand over to the next person.\n\n<b>Please respond to confirm your availability on those dates</b> 🙏\n\nIf you are unavailable on those dates, please find a replacement and let me know at the earliest.\n\nPranam', '', ''],
    ['availability_check', 'Copy availability check', 'person', 'message', '',
      'Namaskaram {{title}},\n\nJust confirming you are available for Shrine process from {{slot_dates}} 🙏', '', ''],
    ['kit_reminder', 'Copy kit reminder', 'person', 'message', '',
      'Namaskaram {{title}} 🙏\n\nGentle reminder that your Shrine Process starts tomorrow. Pls confirm once you collected the kit from {{prev_person}}.\nAfter your 3 days, pls refill and hand over to {{next_person}} 🙏', '', ''],
    AVAILABILITY_REQUEST_TEMPLATE,
  ];

  templates.forEach((t) => sheet.appendRow(t));
}

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'verify') {
    const passcode = e.parameter.passcode || '';
    const stored = PropertiesService.getScriptProperties().getProperty(PASSCODE_PROP) || 'shrine';
    return jsonResponse({ ok: passcode === stored });
  }

  if (action === 'state') {
    // Expiring stale requests writes to the sheet, so take the lock when it is free.
    const lock = LockService.getScriptLock();
    const locked = lock.tryLock(5000);
    try {
      return jsonResponse(readState({ write: locked }));
    } finally {
      if (locked) lock.releaseLock();
    }
  }

  return jsonResponse({ error: 'unknown action' });
}

function doPost(e) {
  if (!e.postData || !e.postData.contents) {
    return jsonResponse({ ok: false, reason: 'empty post' });
  }
  const body = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const result = handleMutation(body);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, reason: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function mutationFieldKey(body) {
  switch (body.action) {
    case 'setAck':
      return 'seq:slot:' + body.slot + ':' + body.field;
    case 'assign':
    case 'book':
    case 'unbook':
    case 'removePerson':
    case 'restoreSlot':
      return 'seq:slot:' + body.slot + ':personId';
    case 'setNote':
      return 'seq:slot:' + body.slot + ':note';
    case 'createRequest':
      return 'seq:request:' + body.requestId + ':create';
    case 'confirmRequest':
    case 'cancelRequest':
    case 'reopenRequest':
      return 'seq:request:' + body.requestId + ':status';
    case 'setAvailability':
      return 'seq:person:' + body.personId + ':available';
    case 'setBackup':
      return 'seq:person:' + body.personId + ':backup';
    default:
      return null;
  }
}

function lastAppliedSeq(body) {
  const key = mutationFieldKey(body);
  if (!key) return 0;
  return Number(PropertiesService.getScriptProperties().getProperty(key) || '0');
}

function rememberSeq(body) {
  const seq = Number(body.seq);
  if (!seq) return;
  const key = mutationFieldKey(body);
  if (key) PropertiesService.getScriptProperties().setProperty(key, String(seq));
}

function shouldApplySeq(body) {
  const seq = Number(body.seq);
  if (!seq) return true;
  return seq > lastAppliedSeq(body);
}

function handleMutation(body) {
  if (!shouldApplySeq(body)) {
    return { ok: true, ignored: true, state: readState() };
  }

  const action = body.action;
  let result;

  switch (action) {
    case 'setAck':
      result = setAck(body.slot, body.field, body.value);
      break;
    case 'assign':
      result = assignSlot(body.slot, body.personId);
      break;
    case 'setAvailability':
      result = setAvailability(body.personId, body.available);
      break;
    case 'setBackup':
      result = setBackup(body.personId, body.backup);
      break;
    case 'book':
      result = bookSlot(body.slot, body.personId);
      break;
    case 'unbook':
      result = unbookSlot(body.slot, body.personId);
      break;
    case 'removePerson':
      result = removePerson(body.slot);
      break;
    case 'restoreSlot':
      result = restoreSlot(body.slot, body.snapshot || {});
      break;
    case 'setNote':
      result = setNote(body.slot, body.note);
      break;
    case 'createRequest':
      result = createRequest(body.requestId, body.personId, body.slot);
      break;
    case 'confirmRequest':
      result = confirmRequest(body.requestId);
      break;
    case 'cancelRequest':
      result = cancelRequest(body.requestId);
      break;
    case 'reopenRequest':
      result = reopenRequest(body.requestId);
      break;
    default:
      return { ok: false, reason: 'unknown action' };
  }

  if (result && result.ok) rememberSeq(body);
  return result;
}

/** Mutations hold the script lock, so they may write; a GET writes only when it got the lock. */
function readState(opts) {
  const canWrite = !opts || opts.write !== false;
  ensureSlotColumns();
  const people = readPeople();
  const slots = readSlots();
  const templates = readTemplates(canWrite);
  const requests = readRequests(canWrite);
  const version = parseInt(getMeta('version') || '1', 10);
  return { people, slots, templates, requests, version };
}

/** CR-157: add the note columns to an existing Slots tab. */
function ensureSlotColumns() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.length >= SLOT_HEADERS.length && headers[5] === 'note') return;
  sheet.getRange(1, 1, 1, SLOT_HEADERS.length).setValues([SLOT_HEADERS]);
}

function readPeople() {
  ensurePeopleNeverDoneColumn();
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const neverCol = headers.indexOf('neverDone');
  const people = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    people.push({
      id: String(row[0]),
      title: row[1],
      name: row[2],
      fullName: row[3],
      available: row[4] === true || row[4] === 'TRUE' || row[4] === 'true',
      backup: row[5] === true || row[5] === 'TRUE' || row[5] === 'true',
      email: row[6] || null,
      phone: row[7] || null,
      whatsapp: row[8] || null,
      language: row[9] || null,
      neverDone: neverCol >= 0 && (row[neverCol] === true || row[neverCol] === 'TRUE' || row[neverCol] === 'true'),
      lastDone: null,
    });
  }
  return recomputeLastDone(people, readSlotsRaw());
}

function ensurePeopleNeverDoneColumn() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  if (!sheet) return;
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('neverDone') === -1) {
    sheet.getRange(1, headers.length + 1).setValue('neverDone');
  }
}

function readSlotsRaw() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const data = sheet.getDataRange().getValues();
  const slots = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === '' || row[0] === null) continue;
    slots.push({
      index: Number(row[0]),
      personId: row[1] === '' || row[1] === null ? null : String(row[1]),
      confirmedAt: row[2] || null,
      kitAckAt: row[3] || null,
      doneAt: row[4] || null,
      note: row[5] ? String(row[5]) : null,
      noteUpdatedAt: row[6] || null,
    });
  }
  return slots;
}

function readSlots() {
  return readSlotsRaw();
}

function readTemplates(canWrite) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.TEMPLATES);
  let data = sheet.getDataRange().getValues();
  // CR-164: add the Availability request row once; after that the sheet owns its text.
  const hasRequestTemplate = data.some(function (row) { return row[0] === AVAILABILITY_REQUEST_TEMPLATE[0]; });
  if (!hasRequestTemplate && canWrite) {
    sheet.appendRow(AVAILABILITY_REQUEST_TEMPLATE);
    data = sheet.getDataRange().getValues();
  }
  const templates = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    templates.push({
      id: row[0],
      label: row[1],
      scope: row[2],
      channel: row[3],
      subject: { en: row[4] || null, ta: row[6] || null },
      body: { en: row[5] || '', ta: row[7] || '' },
    });
  }
  return templates;
}

function setAck(slotIndex, field, value) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);

  const colMap = { confirmedAt: 3, kitAckAt: 4, doneAt: 5 };
  const col = colMap[field];
  sheet.getRange(row, col).setValue(value ? new Date().toISOString() : '');
  bumpVersion();
  return { ok: true, state: readState() };
}

function assignSlot(slotIndex, personId) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);

  sheet.getRange(row, 2, 1, 6).setValues([[personId, '', '', '', '', '']]);
  resolveRequestsOnFill(slotIndex, personId, false);
  bumpVersion();
  return { ok: true, state: readState() };
}

function setAvailability(personId, available) {
  const peopleSheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const peopleRow = findPersonRow(peopleSheet, personId);
  if (!peopleRow) return { ok: false, reason: 'person not found' };

  peopleSheet.getRange(peopleRow, 5).setValue(available);

  if (!available) {
    const slotsSheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
    const data = slotsSheet.getDataRange().getValues();
    const today = startOfDay(new Date());
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(personId)) {
        const idx = Number(data[i][0]);
        const end = slotEnd(idx);
        if (end >= today) {
          slotsSheet.getRange(i + 1, 2, 1, 6).setValues([['', '', '', '', '', '']]);
        }
      }
    }
  }

  bumpVersion();
  return { ok: true, state: readState() };
}

function setBackup(personId, backup) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const row = findPersonRow(sheet, personId);
  if (!row) return { ok: false, reason: 'person not found' };
  sheet.getRange(row, 6).setValue(backup);
  bumpVersion();
  return { ok: true, state: readState() };
}

function bookSlot(slotIndex, personId) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);

  const currentPerson = sheet.getRange(row, 2).getValue();
  if (currentPerson) {
    return { ok: false, reason: 'taken', state: readState() };
  }

  sheet.getRange(row, 2, 1, 6).setValues([[personId, '', '', '', '', '']]);
  resolveRequestsOnFill(slotIndex, personId, true);
  bumpVersion();

  const person = readPeople().find((p) => p.id === personId);
  const coordinatorEmail = PropertiesService.getScriptProperties().getProperty(COORDINATOR_EMAIL_PROP);
  if (coordinatorEmail && person) {
    const range = formatSlotRange(slotIndex);
    MailApp.sendEmail(
      coordinatorEmail,
      'Shrine Process — slot booked',
      person.fullName + ' booked ' + range,
    );
  }

  return { ok: true, state: readState() };
}

/** CR-130, CR-132: undo a self-booking made from this device; tell the coordinator. */
function unbookSlot(slotIndex, personId) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = findSlotRow(sheet, slotIndex);
  if (!row) return { ok: false, reason: 'not found', state: readState() };
  const values = sheet.getRange(row, 2, 1, 4).getValues()[0];
  if (String(values[0]) !== String(personId) || values[1] || values[2] || values[3]) {
    return { ok: false, reason: 'changed', state: readState() };
  }
  sheet.getRange(row, 2, 1, 6).setValues([['', '', '', '', '', '']]);
  bumpVersion();

  const person = readPeople().find((p) => p.id === String(personId));
  const coordinatorEmail = PropertiesService.getScriptProperties().getProperty(COORDINATOR_EMAIL_PROP);
  if (coordinatorEmail && person) {
    MailApp.sendEmail(
      coordinatorEmail,
      'Shrine Process — booking removed',
      person.fullName + ' removed their booking for ' + formatSlotRange(slotIndex) + '. The slot is open again.',
    );
  }
  return { ok: true, state: readState() };
}

/** CR-151: back to TBD. No email (CR-156). Closed requests stay closed (CR-187). */
function removePerson(slotIndex) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);
  sheet.getRange(row, 2, 1, 6).setValues([['', '', '', '', '', '']]);
  bumpVersion();
  return { ok: true, state: readState() };
}

/** CR-153: Undo of Remove person puts back exactly what was there. */
function restoreSlot(slotIndex, snap) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);
  sheet.getRange(row, 2, 1, 6).setValues([[
    snap.personId || '', snap.confirmedAt || '', snap.kitAckAt || '', snap.doneAt || '',
    snap.note || '', snap.noteUpdatedAt || '',
  ]]);
  if (snap.personId) resolveRequestsOnFill(slotIndex, String(snap.personId), false);
  bumpVersion();
  return { ok: true, state: readState() };
}

/** CR-162, CR-163 */
function setNote(slotIndex, note) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, slotIndex);
  const text = String(note || '').trim().slice(0, NOTE_MAX_LENGTH);
  sheet.getRange(row, 6, 1, 2).setValues([[text, text ? new Date().toISOString() : '']]);
  bumpVersion();
  return { ok: true, state: readState() };
}

// ---------------------------------------------------------------------------
// Requests (CR05)

function requestsSheet() {
  return getOrCreateSheet(getSpreadsheet(), SHEETS.REQUESTS, REQUEST_HEADERS);
}

function readRequestRows() {
  const sheet = requestsSheet();
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    rows.push({
      row: i + 1,
      id: String(r[0]),
      personId: String(r[1]),
      slotIndex: Number(r[2]),
      status: String(r[3]),
      createdAt: r[4] instanceof Date ? r[4].toISOString() : String(r[4] || ''),
      closedAt: r[5] ? (r[5] instanceof Date ? r[5].toISOString() : String(r[5])) : null,
    });
  }
  return rows;
}

function setRequestStatus(req, status) {
  const closedAt = status === 'open' ? '' : new Date().toISOString();
  const sheet = requestsSheet();
  sheet.getRange(req.row, 4).setValue(status);
  sheet.getRange(req.row, 6).setValue(closedAt);
  req.status = status;
  req.closedAt = closedAt || null;
}

/** CR-186: an open request whose slot has started is expired. */
function readRequests(canWrite) {
  const rows = readRequestRows();
  const today = startOfDay(new Date());
  rows.forEach(function (r) {
    if (r.status !== 'open' || !(slotStart(r.slotIndex) < today)) return;
    if (canWrite) setRequestStatus(r, 'expired');
    else r.status = 'expired';
  });
  return rows.map(function (r) {
    return {
      id: r.id, personId: r.personId, slotIndex: r.slotIndex,
      status: r.status, createdAt: r.createdAt, closedAt: r.closedAt,
    };
  });
}

/** CR-185, CR-185a — runs inside the caller's lock. */
function resolveRequestsOnFill(slotIndex, personId, selfBooking) {
  readRequestRows().forEach(function (r) {
    if (r.status !== 'open') return;
    if (r.slotIndex === Number(slotIndex)) {
      setRequestStatus(r, r.personId === String(personId) ? 'confirmed' : 'released');
    } else if (selfBooking && r.personId === String(personId)) {
      setRequestStatus(r, 'confirmed');
    }
  });
}

function createRequest(requestId, personId, slotIndex) {
  const rows = readRequestRows();
  if (rows.some(function (r) { return r.id === String(requestId); })) {
    return { ok: true, state: readState() };
  }
  // CR-169: one open request per person.
  if (rows.some(function (r) { return r.personId === String(personId) && r.status === 'open'; })) {
    return { ok: true, ignored: true, state: readState() };
  }
  requestsSheet().appendRow([String(requestId), String(personId), Number(slotIndex), 'open', new Date().toISOString(), '']);
  bumpVersion();
  return { ok: true, state: readState() };
}

/** CR-180: atomic under the script lock; CR-182: never overwrite a filled slot. */
function confirmRequest(requestId) {
  const req = readRequestRows().find(function (r) { return r.id === String(requestId); });
  if (!req || req.status !== 'open') return { ok: true, ignored: true, state: readState() };

  const sheet = getSpreadsheet().getSheetByName(SHEETS.SLOTS);
  const row = ensureSlotRow(sheet, req.slotIndex);
  const holderId = sheet.getRange(row, 2).getValue();
  if (holderId && String(holderId) !== req.personId) {
    const holder = readPeople().find(function (p) { return p.id === String(holderId); });
    return { ok: false, reason: 'filled', holder: holder ? holder.fullName : 'someone else', state: readState() };
  }

  sheet.getRange(row, 2, 1, 6).setValues([[req.personId, new Date().toISOString(), '', '', '', '']]);
  resolveRequestsOnFill(req.slotIndex, req.personId, false);
  bumpVersion();
  return { ok: true, state: readState() };
}

function cancelRequest(requestId) {
  const req = readRequestRows().find(function (r) { return r.id === String(requestId); });
  if (req && req.status === 'open') {
    setRequestStatus(req, 'cancelled');
    bumpVersion();
  }
  return { ok: true, state: readState() };
}

/** Undo of Cancel request (CR-184). */
function reopenRequest(requestId) {
  const rows = readRequestRows();
  const req = rows.find(function (r) { return r.id === String(requestId); });
  const otherOpen = req && rows.some(function (r) { return r.personId === req.personId && r.status === 'open'; });
  if (req && req.status === 'cancelled' && !otherOpen) {
    setRequestStatus(req, 'open');
    bumpVersion();
  }
  return { ok: true, state: readState() };
}

function findSlotRow(sheet, index) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === index) return i + 1;
  }
  return null;
}

function ensureSlotRow(sheet, index) {
  const existing = findSlotRow(sheet, index);
  if (existing) return existing;
  sheet.appendRow([index, '', '', '', '', '', '']);
  return sheet.getLastRow();
}

function findPersonRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) return i + 1;
  }
  return null;
}

function bumpVersion() {
  const ss = getSpreadsheet();
  const v = parseInt(getMeta('version') || '1', 10) + 1;
  setMeta(ss, 'version', String(v));
}

function recomputeLastDone(people, slots) {
  return people.map((p) => {
    let latest = null;
    slots.forEach((s) => {
      if (String(s.personId) === String(p.id) && s.doneAt) {
        const end = slotEnd(s.index);
        if (!latest || end > latest) latest = end;
      }
    });
    return {
      ...p,
      lastDone: latest ? formatDateISO(latest) : null,
    };
  });
}

// Slot arithmetic
function slotStart(index) {
  const d = new Date(ANCHOR_DATE);
  d.setDate(d.getDate() + index * 3);
  return startOfDay(d);
}

function slotEnd(index) {
  const d = slotStart(index);
  d.setDate(d.getDate() + 2);
  return startOfDay(d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateISO(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatSlotRange(index) {
  const start = slotStart(index);
  const end = slotEnd(index);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (start.getMonth() === end.getMonth()) {
    return start.getDate() + '–' + end.getDate() + ' ' + months[end.getMonth()];
  }
  return start.getDate() + ' ' + months[start.getMonth()] + ' – ' +
    end.getDate() + ' ' + months[end.getMonth()];
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
