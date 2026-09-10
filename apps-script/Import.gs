/**
 * One-time CSV import for People and Slots.
 * Run importPeopleFromSheet() after pasting the names CSV into a "ImportPeople" sheet.
 * Run importSlotsFromSheet() after pasting slot data into "ImportSlots" sheet.
 */

function importPeopleFromSheet() {
  const ss = getSpreadsheet();
  const importSheet = ss.getSheetByName('ImportPeople');
  if (!importSheet) {
    Logger.log('Create a sheet named ImportPeople and paste the CSV there (with headers).');
    return;
  }

  const peopleSheet = ss.getSheetByName('People');
  const data = importSheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const brNo = String(row[0]).trim();
    const nameCol = String(row[1]).trim();
    const contact = String(row[3] || '').trim();
    const comm = String(row[4] || '').trim();
    const email = String(row[5] || '').trim();
    const inAshram = String(row[6] || '').trim();

    if (!nameCol || !brNo) continue;

    const parsed = parseTitleName(nameCol);
    const contacts = parseComm(comm, contact, email);
    const available = isInAshram(inAshram);

    rows.push([
      brNo, parsed.title, parsed.name, parsed.fullName,
      available, false,
      contacts.email, contacts.phone, contacts.whatsapp, '',
    ]);
  }

  if (peopleSheet.getLastRow() > 1) {
    peopleSheet.getRange(2, 1, peopleSheet.getLastRow() - 1, 10).clearContent();
  }
  if (rows.length > 0) {
    peopleSheet.getRange(2, 1, rows.length, 10).setValues(rows);
  }

  Logger.log('Imported ' + rows.length + ' people.');
}

function importSlotsFromSheet() {
  const ss = getSpreadsheet();
  const importSheet = ss.getSheetByName('ImportSlots');
  if (!importSheet) {
    Logger.log('Create a sheet named ImportSlots and paste the reserve CSV there.');
    return;
  }

  const peopleSheet = ss.getSheetByName('People');
  const peopleData = peopleSheet.getDataRange().getValues();
  const nameToId = {};
  for (let i = 1; i < peopleData.length; i++) {
    nameToId[String(peopleData[i][3]).toLowerCase()] = String(peopleData[i][0]);
  }

  const slotsSheet = ss.getSheetByName('Slots');
  const data = importSheet.getDataRange().getValues();
  const assignments = {};

  for (let i = 3; i < data.length; i++) {
    const startStr = String(data[i][7] || '').trim();
    const personName = String(data[i][9] || '').trim();
    if (!startStr || !personName) continue;

    const start = parseFlexibleDate(startStr);
    if (!start) continue;

    const index = slotIndexFromStart(start);
    const personId = nameToId[personName.toLowerCase()];
    if (personId) assignments[index] = personId;
  }

  const slotRows = [];
  for (let i = -4; i <= 47; i++) {
    slotRows.push([i, assignments[i] || '', '', '', '']);
  }

  if (slotsSheet.getLastRow() > 1) {
    slotsSheet.getRange(2, 1, slotsSheet.getLastRow() - 1, 5).clearContent();
  }
  slotsSheet.getRange(2, 1, slotRows.length, 5).setValues(slotRows);
  Logger.log('Imported ' + slotRows.length + ' slots, ' + Object.keys(assignments).length + ' assigned.');
}

function parseTitleName(full) {
  const trimmed = full.trim();
  if (trimmed.indexOf('Swami ') === 0) {
    return { title: 'Swami', name: trimmed.slice(6), fullName: trimmed };
  }
  if (trimmed.indexOf('Maa ') === 0) {
    return { title: 'Maa', name: trimmed.slice(4), fullName: trimmed };
  }
  return { title: 'Swami', name: trimmed, fullName: trimmed };
}

function isInAshram(value) {
  const v = value.trim().toLowerCase();
  return v === 'yes' || v === 'y';
}

function parseComm(comm, contact, email) {
  const c = comm.toUpperCase();
  const contactClean = contact.replace(/[\s\u202a\u202c]/g, '');
  const emailClean = email.split('&')[0].trim();

  var emailVal = null, phoneVal = null, whatsappVal = null;

  if (emailClean && emailClean.indexOf('@') > -1) emailVal = emailClean;
  if (c.indexOf('WA') > -1 && contactClean) whatsappVal = contactClean;
  else if (c.indexOf('SMS') > -1 && contactClean) phoneVal = contactClean;
  else if (contactClean && /^\d/.test(contactClean)) phoneVal = contactClean;

  return { email: emailVal, phone: phoneVal, whatsapp: whatsappVal };
}

function parseFlexibleDate(str) {
  var cleaned = str.replace(/\s/g, '');
  var match = cleaned.match(/^([A-Za-z]+)-(\d{1,2})$/);
  if (!match) return null;

  var months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  var month = months[match[1].toLowerCase().slice(0, 3)];
  var day = parseInt(match[2], 10);
  if (month === undefined) return null;

  for (var y = 0; y < 2; y++) {
    var year = y === 0 ? 2026 : 2027;
    var d = new Date(year, month, day);
    var idx = slotIndexFromStart(d);
    var expected = slotStart(idx);
    if (expected.getFullYear() === d.getFullYear() &&
        expected.getMonth() === d.getMonth() &&
        expected.getDate() === d.getDate()) {
      return d;
    }
  }
  return null;
}

function slotIndexFromStart(start) {
  var anchor = startOfDay(ANCHOR_DATE);
  var s = startOfDay(start);
  var days = Math.round((s - anchor) / (1000 * 60 * 60 * 24));
  return Math.round(days / 3);
}
