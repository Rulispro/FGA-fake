const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ===============================
// AMBIL GROUP VIA API GRAPHQL
// ===============================
async function getGroupLinks(page, accountName){

  console.log(`📥 [${accountName}] Buka halaman daftar grup...`);

  const groupResults = [];

  const handler = async (response) => {
    try {
      const url = response.url();

      // DEBUG (optional)
      // console.log("🌐 API:", url);

      if (url.includes("graphql")) {

        const json = await response.json();
        const text = JSON.stringify(json);

        const matches = text.match(/"name":"(.*?)".*?"id":"(\d+)".*?"uri":"(https.*?)"/g);

        if (matches) {
          matches.forEach(m => {

            const name = m.match(/"name":"(.*?)"/)?.[1];
            const id = m.match(/"id":"(\d+)"/)?.[1];
            const photo = m.match(/"uri":"(https.*?)"/)?.[1];

            if (name && id) {
              groupResults.push({
                name,
                id,
                photo,
                link: `https://m.facebook.com/groups/${id}`
              });
            }

          });
        }

      }

    } catch (e) {}
  };

  // pasang listener
  page.on("response", handler);

  

  await delay(5000);

  console.log(`📜 Scroll halaman...`);

  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(2000);
  }

  // tunggu response API masuk
  await delay(5000);

  // ❗ penting: lepas listener
  page.off("response", handler);

  // ===============================
  // HAPUS DUPLIKAT
  // ===============================
  const unique = [];
  const seen = new Set();

  groupResults.forEach(g => {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      unique.push(g);
    }
  });

  console.log(`📊 Total grup dari API: ${unique.length}`);

  if (unique.length === 0){
    console.log("⚠️ WARNING: Tidak ada grup keambil (API)");
  }

  return unique;
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

// klik menu Groups
try {
await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Facebook Menu"]');

  if (btn) {
    btn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }
});
  
  console.log("✅ Klik menu Groups");
  await delay(5000);

} catch (e) {
  console.log("❌ Gagal klik menu Groups");
}
await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Groups"]');

  if (btn) {
    btn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }
});
    await delay(4000);

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
