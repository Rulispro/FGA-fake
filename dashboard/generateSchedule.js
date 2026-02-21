const fs = require("fs");
const xlsx = require("xlsx");

// ===============================
// READ EXCEL
// ===============================
const workbook = xlsx.readFile("./dashboard/template1.xlsx");
console.log("📑 Semua sheet:", workbook.SheetNames);

const sheet = workbook.Sheets["postGroup"];
if (!sheet) {
  console.log("❌ Sheet postGroup tidak ditemukan!");
  process.exit(1);
}

let rows = xlsx.utils.sheet_to_json(sheet);
console.log("📋 Total row postGroup:", rows.length);
console.log("📋 Contoh row pertama:", rows[0]);

// ===============================
// CLEAN HEADER (hapus spasi)
// ===============================
function cleanRow(row) {
  const newRow = {};
  Object.keys(row).forEach(key => {
    newRow[key.trim()] = row[key];
  });
  return newRow;
}

rows = rows.map(cleanRow);

// ===============================
// PARSE TANGGAL (support Excel serial)
// ===============================
function parseTanggal(value) {
  if (!value) return null;

  // Jika angka (Excel serial date)
  if (typeof value === "number") {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    return excelDate.toISOString().slice(0, 10);
  }

  // Jika string biasa
  const d = new Date(value);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  return null;
}

// ===============================
// EXPAND RANGE TANGGAL
// ===============================
function expandRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const last = new Date(end);

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ===============================
// GENERATE SCHEDULE
// ===============================
const schedule = {};

rows.forEach(row => {

  if (!row.tanggal || !row.account) return;

  let dates = [];

  if (typeof row.tanggal === "string" && row.tanggal.includes("-")) {

    const [startRaw, endRaw] = row.tanggal.split("-");
    const start = parseTanggal(startRaw.trim());
    const end = parseTanggal(endRaw.trim());

    if (start && end) {
      dates = expandRange(start, end);
    }

  } else {
    const single = parseTanggal(row.tanggal);
    if (single) dates = [single];
  }

  dates.forEach(date => {

    if (!schedule[date]) {
      schedule[date] = [];
    }

    schedule[date].push({
      account: String(row.account).trim(),
      group_name: row.group_name || "-",
      caption: row.caption || "-",
      group_link: row.grup_link || "-",
      jam: row.jam || "12:00",
      delay_grup: row.delay_grup || "5000,7000",
      delay_akun: row.delay_akun || 10000,
      delay_mikir: row.delay_mikir || 500,
      ketik_min: row.ketik_min || 100,
      ketik_max: row.ketik_max || 120,
      pause_chance: row.pause_chance || 0,
      pause_min: row.pause_min || 0,
      pause_max: row.pause_max || 0,
      status: "scheduled"
    });

  });

});

// ===============================
// SAVE JSON
// ===============================
if (!fs.existsSync("./docs")) {
  fs.mkdirSync("./docs");
}

fs.writeFileSync(
  "./docs/schedule.json",
  JSON.stringify(schedule, null, 2)
);

console.log("✅ schedule.json berhasil dibuat di docs/");
