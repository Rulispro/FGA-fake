const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");
puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ============================
      
    
    async function getGroupLinks(page, accountName){

  console.log(`📥 [${accountName}] Buka groups...`);

  await page.goto("https://m.facebook.com/groups/joins/", {
    waitUntil: "domcontentloaded"
  });

  console.log("🌐 REAL URL:", page.url());

  await page.waitForTimeout(5000);

  // =========================
  // 🔥 SCROLL DI SINI (WAJIB)
  // =========================
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(2000);
  }

  // =========================
  // SCRAPE SETELAH SCROLL
  // =========================
  const groups = await page.evaluate(() => {
  const result = [];

  const cards = document.querySelectorAll("div");

  cards.forEach(card => {

    // 🔗 ambil link group
    const a = card.querySelector("a[href*='/groups/']");
    if (!a) return;

    const href = a.href || "";

    // 🆔 ambil userid dari URL
    const match = href.match(/groups\/(\d+)/);
    const id = match ? match[1] : null;

    if (!id) return;

    // 👤 ambil nama dari seluruh card
    const name = card.innerText
      ?.split("\n")
      .find(t =>
        t &&
        t.length > 2 &&
        t.length < 80
      )
      ?.trim();

    // 🖼 ambil foto dari card
    const img = card.querySelector("img");
    const photo = img ? img.src : null;

    // 🔥 hasil akhir
    result.push({
      id: id,
      name: name || null,
      link: `https://m.facebook.com/groups/${id}`,
      photo: photo || null
    });
  });

  // 🔁 hapus duplikat
  return [...new Map(result.map(x => [x.id, x])).values()];
});
      
  console.log(`📊 Total grup: ${groups.length}`);

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
 // BARU recorder dibuat
const recorder = new PuppeteerScreenRecorder(page);
await recorder.start("video.mp4");
  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9"
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  

  

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
///await page.setRequestInterception(true);

///page.on('request', req => {
 /// if (req.url().includes("m.facebook.com")) {
   /// console.log("⛔ BLOCK REDIRECT:", req.url());
 ///   return req.abort();
///  }
//  req.continue();
///});
    // reload biar login aktif
    await page.goto("https://m.facebook.com", {
  waitUntil: "networkidle2"
});

await delay(5000);


    console.log(`✅ Login berhasil: ${accountData.account}`);
    console.log("🌐 URL sekarang:", await page.url());

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
 
  
  await recorder.stop();
  await browser.close();

  if (!fs.existsSync("./docs"))
    fs.mkdirSync("./docs");

  fs.writeFileSync(
    "./docs/groups.json",
    JSON.stringify(allGroupsPerAccount, null, 2)
  );

  console.log("\n✅ groups.json berhasil dibuat");

})();
