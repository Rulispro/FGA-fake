const fs = require("fs");
const xlsx = require("xlsx");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

// ===============================
// RANDOM DELAY
// ===============================
function randomDelay(min = 2000, max = 9000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

(async () => {

let scrapeCount = 0;
const MAX_SCRAPE_PER_RUN = 20;

// ===============================
// READ EXCEL
// ===============================
const workbook = xlsx.readFile("./dashboard/template1.xlsx");
const sheet = workbook.Sheets["postGroup"];

if (!sheet) {
  console.log("❌ Sheet postGroup tidak ditemukan");
  process.exit(1);
}

let rows = xlsx.utils.sheet_to_json(sheet);

// ===============================
// CLEAN HEADER
// ===============================
rows = rows.map(row => {
  const newRow = {};
  Object.keys(row).forEach(key => {
    newRow[key.trim()] = row[key];
  });
  return newRow;
});

// ===============================
// PARSE TANGGAL
// ===============================
function parseTanggal(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    return excelDate.toISOString().slice(0, 10);
  }

  const d = new Date(value);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  return null;
}

// ===============================
// LOAD CACHE GROUP
// ===============================
let groupCache = {};

if (fs.existsSync("./docs/groups.json")) {
  groupCache = JSON.parse(
    fs.readFileSync("./docs/groups.json")
  );
}

const schedule = {};

// ===============================
// LOAD ACCOUNTS
// ===============================
const accounts = JSON.parse(
  fs.readFileSync("./dashboard/accounts.json")
);

// ===============================
// START BROWSER
// ===============================
const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ]
});

const page = await browser.newPage();

// MOBILE MODE
await page.setUserAgent(
  "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
);

await page.setViewport({
  width: 390,
  height: 844,
  isMobile: true
});

// ===============================
// PROCESS ROWS
// ===============================
for (const row of rows) {

  if (!row.tanggal || !row.account || !row.grup_link) continue;

  const date = parseTanggal(row.tanggal);
  if (!date) continue;

  const accountName = String(row.account).trim();

  const accountData = accounts.find(
    acc => acc.account.trim() === accountName
  );

  if (!accountData) {
    console.log("❌ Account tidak ditemukan:", accountName);
    continue;
  }

  // ===============================
  // LOGIN VIA COOKIE
  // ===============================
  await page.goto("https://m.facebook.com", {
    waitUntil: "networkidle2"
  });

  const existingCookies = await page.cookies();
  if (existingCookies.length > 0)
    await page.deleteCookie(...existingCookies);

  await page.setCookie(
    ...accountData.cookies.map(cookie => ({
      ...cookie,
      domain: ".facebook.com",
      path: "/"
    }))
  );

  console.log("✅ Login pakai:", accountName);

  const links = row.grup_link
    .split(",")
    .map(l => l.trim());

  // ===============================
  // LOOP GROUP
  // ===============================
  for (const groupUrl of links) {

    let groupInfo;

    // ===== CACHE HIT =====
    if (groupCache[groupUrl]) {
      console.log("Cache hit:", groupUrl);
      groupInfo = groupCache[groupUrl];
    } else {

      if (scrapeCount >= MAX_SCRAPE_PER_RUN) {
        console.log("⚠ Limit scrape tercapai");
        continue;
      }

      scrapeCount++;
      console.log("Scraping:", groupUrl);

      await page.goto(groupUrl, {
        waitUntil: "networkidle2",
        timeout: 60000
      });

      await page.waitForTimeout(randomDelay(3000,6000));
      await page.evaluate(() => window.scrollBy(0,300));
      await page.waitForTimeout(randomDelay(1500,3000));

      // ===============================
      // SCRAPE GROUP INFO
      // ===============================
      groupInfo = await page.evaluate(() => {

        const rawTitle = document.title || "Unknown Group";
        const name = rawTitle
          .replace(/\s*\|\s*Facebook/i,"")
          .trim();

        // PRIORITAS COVER GROUP
        const img =
          document.querySelector('img[alt*="cover"]') ||
          document.querySelector('img[role="img"]') ||
          document.querySelector('img[src*="scontent"]');

        return {
          name,
          photo: img ? img.src : null
        };
      });

      groupCache[groupUrl] = groupInfo;
    }

    if (!schedule[date]) schedule[date] = [];

    // ===============================
    // PUSH DATA (NO ACCOUNT PHOTO)
    // ===============================
    schedule[date].push({
      account: accountName,
      group_link: groupUrl,
      group_name: groupInfo.name,
      group_photo: groupInfo.photo,
      caption: row.caption || "-",
      jam: row.jam || "12:00",
      status: "scheduled"
    });

    await page.waitForTimeout(randomDelay(2000,4000));
  }
}

await browser.close();

// ===============================
// SAVE FILES
// ===============================
if (!fs.existsSync("./docs"))
  fs.mkdirSync("./docs");

fs.writeFileSync(
  "./docs/groups.json",
  JSON.stringify(groupCache,null,2)
);

fs.writeFileSync(
  "./docs/schedule.json",
  JSON.stringify(schedule,null,2)
);

console.log("✅ schedule.json & groups.json updated");
console.log("Total scrape run ini:", scrapeCount);

})();
  
