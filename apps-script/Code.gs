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
  META: 'Meta',
};

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

  getOrCreateSheet(ss, SHEETS.SLOTS, [
    'index', 'personId', 'confirmedAt', 'kitAckAt', 'doneAt',
  ]);

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
    return jsonResponse(readState());
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

function handleMutation(body) {
  const action = body.action;

  switch (action) {
    case 'setAck':
      return setAck(body.slot, body.field, body.value);
    case 'assign':
      return assignSlot(body.slot, body.personId);
    case 'setAvailability':
      return setAvailability(body.personId, body.available);
    case 'setBackup':
      return setBackup(body.personId, body.backup);
    case 'book':
      return bookSlot(body.slot, body.personId);
    default:
      return { ok: false, reason: 'unknown action' };
  }
}

function readState() {
  const people = readPeople();
  const slots = readSlots();
  const templates = readTemplates();
  const version = parseInt(getMeta('version') || '1', 10);
  return { people, slots, templates, version };
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
      personId: row[1] || null,
      confirmedAt: row[2] || null,
      kitAckAt: row[3] || null,
      doneAt: row[4] || null,
    });
  }
  return slots;
}

function readSlots() {
  return readSlotsRaw();
}

function readTemplates() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.TEMPLATES);
  const data = sheet.getDataRange().getValues();
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

  sheet.getRange(row, 2, 1, 4).setValues([[personId, '', '', '']]);
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
      if (data[i][1] === personId) {
        const idx = Number(data[i][0]);
        const end = slotEnd(idx);
        if (end >= today) {
          slotsSheet.getRange(i + 1, 2, 1, 4).setValues([['', '', '', '']]);
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

  sheet.getRange(row, 2, 1, 4).setValues([[personId, '', '', '']]);
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
  sheet.appendRow([index, '', '', '', '']);
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
      if (s.personId === p.id && s.doneAt) {
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
