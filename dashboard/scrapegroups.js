const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ============================
      
    async function getGroupLinks(page, accountName){

  console.log(`📥 [${accountName}] Buka mbasic groups...`);

  await page.goto("https://mbasic.facebook.com/groups/?seemore", {
    waitUntil: "networkidle2"
  });

  await delay(5000);

  const groups = await page.evaluate(() => {

    const result = [];

    document.querySelectorAll("a[href*='/groups/']").forEach(a => {

      const href = a.getAttribute("href") || "";

      if (
        href.includes("/groups/") &&
        !href.includes("category") &&
        !href.includes("create") &&
        !href.includes("discover")
      ) {

        const name = (a.innerText || "")
          .split("\n")[0]
          .trim();

        const img = a.querySelector("img");
        const photo = img ? img.src : null;

        const match = href.match(/groups\/(\d+)/);
        const id = match ? match[1] : null;

        if (name && id) {
          result.push({
            id,
            name,
            photo,
            link: `https://m.facebook.com/groups/${id}`
          });
        }

      }

    });

    const unique = [];
    const seen = new Set();

    result.forEach(g => {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        unique.push(g);
      }
    });

    return unique;
  });

  console.log(`📊 Total grup: ${groups.length}`);

  if (groups.length === 0){
    console.log("⚠️ WARNING: Tidak ada grup keambil");
  }

  return groups;
    }



// ===============================
// MAIN
// ===============================
(async () => {

  const accounts = JSON.parse(
    fs.readFileSync("./dashboard/accounts.json")
  );

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9"
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"
  );

  const allGroupsPerAccount = {};

  for (const accountData of accounts) {

    console.log("\n==============================");
    console.log(`🔐 Mulai akun: ${accountData.account}`);

    // reset cookies
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

    // reload biar login aktif
    await page.goto("https://m.facebook.com", {
  waitUntil: "networkidle2"
});

await delay(5000);

/
    console.log(`✅ Login berhasil: ${accountData.account}`);
    console.log(`🌐 URL sekarang: di m.facebook.com/groups`);

    // ===============================
    // AMBIL GROUP
    // ===============================
    const groups = await getGroupLinks(page, accountData.account);

    // DEBUG HTML (optional)
    fs.writeFileSync(`debug-${accountData.account}.html`, await page.content());

    allGroupsPerAccount[accountData.account] = groups;

    console.log(`📦 Selesai akun: ${accountData.account}`);
    console.log(`Total grup tersimpan: ${groups.length}`);

    console.log("⏭ Pindah akun berikutnya...\n");

    await delay(5000);
  }

  await browser.close();

  if (!fs.existsSync("./docs"))
    fs.mkdirSync("./docs");

  fs.writeFileSync(
    "./docs/groups.json",
    JSON.stringify(allGroupsPerAccount, null, 2)
  );

  console.log("\n✅ groups.json berhasil dibuat");

})();
