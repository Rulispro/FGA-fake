const fs = require("fs");
const xlsx = require("xlsx");


// baca excel dari folder dashboard
const workbook = xlsx.readFile("./dashboard/template1.xlsx");
console.log("📑 Semua sheet:", workbook.SheetNames);
const sheet = workbook.Sheets["postGroup"];
if (!sheet) {
  console.log("❌ Sheet postGroup tidak ditemukan!");
  process.exit(1);
}
const rows = xlsx.utils.sheet_to_json(sheet);
console.log("📋 Total row postGroup:", rows.length);
console.log("📋 Contoh row pertama:", rows[0]);
function parseTanggal(str) {
  const d = new Date(str);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
}

function cleanRow(row) {
  const newRow = {};
  Object.keys(row).forEach(key => {
    newRow[key.trim()] = row[key];
  });
  return newRow;
}

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
      account: row.account,
      group_name: row.group_name || "-",
      caption: row.caption || "-",
      group_link: row.grup_link || "-",
      photo: "",
      status: "scheduled"
    });

  });

});

// tulis ke folder docs
fs.writeFileSync(
  "./docs/schedule.json",
  JSON.stringify(schedule, null, 2)
);

console.log("✅ schedule.json berhasil dibuat di docs/");
