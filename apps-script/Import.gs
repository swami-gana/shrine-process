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
  const existing = {};
  const existingData = peopleSheet.getDataRange().getValues();
  const existingHeaders = existingData[0] || [];
  const neverCol = existingHeaders.indexOf('neverDone');
  for (let i = 1; i < existingData.length; i++) {
    const id = String(existingData[i][0]);
    if (!id) continue;
    existing[id] = {
      available: existingData[i][4] === true || existingData[i][4] === 'TRUE' || existingData[i][4] === 'true',
      backup: existingData[i][5] === true || existingData[i][5] === 'TRUE' || existingData[i][5] === 'true',
      neverDone: neverCol >= 0 && (existingData[i][neverCol] === true || existingData[i][neverCol] === 'TRUE' || existingData[i][neverCol] === 'true'),
    };
  }

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
    const seededAvailable = isInAshram(inAshram);
    const prev = existing[brNo];
    const available = prev && prev.available === false ? false : seededAvailable;
    const neverDone = isNeverDone(parsed.title, parsed.name) || !!(prev && prev.neverDone);
    const backup = isBackupSeed(parsed.fullName) ? true : (prev ? prev.backup : false);

    rows.push([
      brNo, parsed.title, parsed.name, parsed.fullName,
      available, backup,
      contacts.email, contacts.phone, contacts.whatsapp, '',
      neverDone,
    ]);
  }

  if (peopleSheet.getLastRow() > 1) {
    peopleSheet.getRange(2, 1, peopleSheet.getLastRow() - 1, 11).clearContent();
  }
  if (rows.length > 0) {
    peopleSheet.getRange(2, 1, rows.length, 11).setValues(rows);
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
    const full = normalizePersonName(peopleData[i][3]);
    const titled = normalizePersonName(String(peopleData[i][1] || '') + ' ' + String(peopleData[i][2] || ''));
    const id = String(peopleData[i][0]);
    if (full) nameToId[full] = id;
    if (titled) nameToId[titled] = id;
  }

  const slotsSheet = ss.getSheetByName('Slots');
  const data = importSheet.getDataRange().getValues();
  const cols = findShrineProcessColumns(data);
  if (!cols) {
    Logger.log('Could not find a column headed "Shrine Process". Put that header on the row above the names.');
    return;
  }
  if (cols.startCol < 0) {
    Logger.log('No Start Dates header to the left of Shrine Process; will look for dates in other cells on each row.');
  } else {
    Logger.log('Reading Shrine Process from column ' + columnLetter(cols.nameCol) +
      ', start dates from column ' + columnLetter(cols.startCol) +
      ', header row ' + (cols.headerRow + 1) + '.');
  }

  const assignments = {};
  const unmatched = [];
  const seenUnmatched = {};
  let namedRows = 0;
  let datedRows = 0;

  for (let i = cols.headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const personName = String(row[cols.nameCol] || '').replace(/\s+/g, ' ').trim();
    if (!personName) continue;
    namedRows++;

    var start = cols.startCol >= 0 ? cellToDate(row[cols.startCol]) : null;
    if (!start) {
      for (var c = 0; c < row.length; c++) {
        if (c === cols.nameCol) continue;
        start = cellToDate(row[c]);
        if (start) break;
      }
    }
    if (!start) continue;
    datedRows++;

    const index = slotIndexFromStart(start);
    const personId = nameToId[normalizePersonName(personName)];
    if (personId) {
      assignments[index] = personId;
    } else if (!seenUnmatched[personName]) {
      seenUnmatched[personName] = true;
      unmatched.push(personName);
    }
  }

  if (datedRows === 0) {
    Logger.log('Named rows: ' + namedRows + ', but none had a parseable start date.');
    Logger.log('Paste three columns starting at A1: Start Dates | End Dates | Shrine Process. Names alone cannot be placed on a date.');
    return;
  }

  const yastir = nameToId['swami yastir'];
  const mukula = nameToId['swami mukula'];
  const seeded = {};
  Object.keys(assignments).forEach(function (key) {
    seeded[Number(key)] = assignments[key];
  });
  if (yastir) seeded[0] = yastir;
  if (mukula) seeded[-1] = mukula;

  const existing = {};
  const existingData = slotsSheet.getLastRow() > 1 ? slotsSheet.getDataRange().getValues() : [];
  for (let i = 1; i < existingData.length; i++) {
    const row = existingData[i];
    if (row[0] === '' || row[0] === null) continue;
    existing[Number(row[0])] = {
      personId: row[1] ? String(row[1]) : '',
      confirmedAt: row[2] || '',
      kitAckAt: row[3] || '',
      doneAt: row[4] || '',
    };
  }

  const indexSet = {};
  for (let i = -4; i <= 47; i++) indexSet[i] = true;
  Object.keys(seeded).forEach(function (key) { indexSet[Number(key)] = true; });
  Object.keys(existing).forEach(function (key) { indexSet[Number(key)] = true; });
  const indices = Object.keys(indexSet).map(Number).sort(function (a, b) { return a - b; });

  const conflicts = [];
  const slotRows = indices.map(function (index) {
    return mergeImportedSlot(index, existing[index], seeded[index] || '', conflicts);
  });

  if (slotsSheet.getLastRow() > 1) {
    slotsSheet.getRange(2, 1, slotsSheet.getLastRow() - 1, 5).clearContent();
  }
  if (slotRows.length > 0) {
    slotsSheet.getRange(2, 1, slotRows.length, 5).setValues(slotRows);
  }

  const assigned = slotRows.filter(function (r) { return r[1]; }).length;
  const markedDone = slotRows.filter(function (r) { return r[4]; }).length;
  Logger.log('Named rows: ' + namedRows + ', rows with a parseable date: ' + datedRows +
    ', matched to a person: ' + Object.keys(assignments).length + '.');
  Logger.log('Wrote ' + slotRows.length + ' slot rows, ' + assigned + ' with a personId, ' +
    markedDone + ' marked done because the dates are already past.');
  if (unmatched.length > 0) {
    Logger.log('Unmatched names (not on the People tab): ' + unmatched.join(', '));
  }
  if (conflicts.length > 0) {
    Logger.log('Left ' + conflicts.length + ' acknowledged slots unchanged:');
    conflicts.forEach(function (c) {
      Logger.log('  slot ' + c.index + ' kept ' + c.existingPersonId + ' (CSV had ' + c.incomingPersonId + ')');
    });
  }
}

function normalizeHeader(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizePersonName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findShrineProcessColumns(rows) {
  var scan = Math.min(rows.length, 15);
  for (var i = 0; i < scan; i++) {
    var row = rows[i] || [];
    for (var j = 0; j < row.length; j++) {
      if (normalizeHeader(row[j]) !== 'shrine process') continue;
      var startCol = j - 2;
      for (var k = j - 1; k >= 0; k--) {
        var header = normalizeHeader(row[k]);
        if (header === 'start dates' || header === 'start date') {
          startCol = k;
          break;
        }
      }
      return { headerRow: i, startCol: startCol, nameCol: j };
    }
  }
  return null;
}

function columnLetter(index) {
  var n = index + 1;
  var s = '';
  while (n > 0) {
    var rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellToDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return startOfDay(value);
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    var d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return parseFlexibleDate(String(value || '').trim());
}

function isPastSlotIndex(index) {
  return slotEnd(index).getTime() < startOfDay(new Date()).getTime();
}

function slotHasAck(prev) {
  return !!(prev && (prev.confirmedAt || prev.kitAckAt || prev.doneAt));
}

function mergeImportedSlot(index, prev, incomingPersonId, conflicts) {
  const current = prev || { personId: '', confirmedAt: '', kitAckAt: '', doneAt: '' };
  let personId = current.personId;
  if (incomingPersonId) {
    if (slotHasAck(current) && current.personId && current.personId !== incomingPersonId) {
      conflicts.push({
        index: index,
        existingPersonId: current.personId,
        incomingPersonId: incomingPersonId,
      });
    } else if (!slotHasAck(current) || !current.personId) {
      personId = incomingPersonId;
    }
  }
  var doneAt = current.doneAt;
  if (!doneAt && personId && isPastSlotIndex(index)) {
    doneAt = slotEnd(index).toISOString();
  }
  return [index, personId, current.confirmedAt, current.kitAckAt, doneAt];
}

var BACKUP_NAMES = ['Maa Mukulita'];

function isBackupSeed(fullName) {
  var key = String(fullName || '').replace(/\s+/g, ' ').trim().toLowerCase();
  for (var i = 0; i < BACKUP_NAMES.length; i++) {
    if (BACKUP_NAMES[i].toLowerCase() === key) return true;
  }
  return false;
}

function seedBackup() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const data = sheet.getDataRange().getValues();
  const seeded = [];
  const missing = BACKUP_NAMES.slice();
  for (let i = 1; i < data.length; i++) {
    const fullName = String(data[i][3] || '');
    if (isBackupSeed(fullName)) {
      sheet.getRange(i + 1, 6).setValue(true);
      seeded.push(fullName);
      const idx = missing.findIndex(function (n) {
        return n.toLowerCase() === fullName.trim().toLowerCase();
      });
      if (idx >= 0) missing.splice(idx, 1);
    }
  }
  Logger.log(seeded.length ? 'Seeded backup for: ' + seeded.join(', ') : 'No backup names matched.');
  if (missing.length > 0) Logger.log('Backup names not found on People: ' + missing.join(', '));
}

function seedNeverDoneFromList() {
  ensurePeopleNeverDoneColumn();
  const sheet = getSpreadsheet().getSheetByName(SHEETS.PEOPLE);
  const data = sheet.getDataRange().getValues();
  const neverCol = data[0].indexOf('neverDone') + 1;
  if (neverCol < 1) {
    Logger.log('neverDone column missing.');
    return;
  }
  let n = 0;
  for (let i = 1; i < data.length; i++) {
    if (isNeverDone(data[i][1], data[i][2])) {
      sheet.getRange(i + 1, neverCol).setValue(true);
      n++;
    }
  }
  Logger.log('Seeded neverDone for ' + n + ' people.');
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
  var cleaned = String(str || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  var iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  var months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  var month, day;
  var mdy = cleaned.match(/^([A-Za-z]+)[-\s]+(\d{1,2})/);
  var dmy = cleaned.match(/^(\d{1,2})[-\s]+([A-Za-z]+)/);
  if (mdy) {
    month = months[mdy[1].toLowerCase().slice(0, 3)];
    day = parseInt(mdy[2], 10);
  } else if (dmy) {
    month = months[dmy[2].toLowerCase().slice(0, 3)];
    day = parseInt(dmy[1], 10);
  }
  if (month === undefined || day === undefined) return null;

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

function isNeverDone(title, name) {
  var key = (title + ' ' + name).toLowerCase();
  return NEVER_DONE_KEYS[key] === true;
}

var NEVER_DONE_KEYS = (function () {
  var maas = 'Ahi,Ameesa,Bhuteshwari,Chandrahasa,Chitravaha,Dakshina,Ekisha,Gambhiri,Girija,Gnana,Gutika,Hruditya,Induba,Irma,Janani,Jayitri,Karpoori,Kripa,Kshema,Kunsi,Maayu,Madhuchandra,Muktika,Mukulita,Naanaki,Naidhruva,Potri,Pranava,Pratapi,Samabuddhi,Sandhya,Suvimala,Trijagati,Trinetri,Vama,Vanasri,Yogadipika'.split(',');
  var swamis = 'Akampita,Aloka,Ambara,Bhalanetra,Bhutamsha,Chidambara,Chitranga,Chitya,Dakshari,Darpana,Dhiraja,Dridapada,Ekapada,Ekavira,Gunita,Guruvira,Hanumesha,Jwalesh,Jyotirmaya,Kaalya,Kailasa,Kalaghata,Kedara,Lavana,Lavitra,Maduka,Mahipa,Mritanda,Nabachari,Naksatra,Nakuja,Nandaka,Nandakara,Nandayanti,Nirakara,Nisarga,Obala,Paaraga,Padmaratha,Pingala,Prabala,Prajagara,Prapana,Pushya,Rabhya,Rashmin,Rukma,Sancharaka,Sankalpa,Shantin,Sitamshu,Somanshu,Srimukha,Subana,Sukhada,Surta,Tanamaya,Tapomula,Tathya,Tavisa,Tushara,Udaaradhi,Ullasa,Unmada,Vahava,Vajrabala,Vasunanda,Vibhu,Vimoha,Yastir,Nabha'.split(',');
  var map = {};
  maas.forEach(function (n) { map['maa ' + n.toLowerCase()] = true; });
  swamis.forEach(function (n) { map['swami ' + n.toLowerCase()] = true; });
  return map;
})();

