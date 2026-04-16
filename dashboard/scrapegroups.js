const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ===============================
// AMBIL LINK GROUP DARI LIST
// ===============================
async function getGroupLinks(page, accountName){

  console.log(`📥 [${accountName}] Buka halaman daftar grup...`);

  await page.goto("https://m.facebook.com/groups/", {
    waitUntil: "networkidle2"
  });

  console.log(`⏳ [${accountName}] Tunggu 5 detik...`);
  await delay(5000);

  console.log(`📜 [${accountName}] Scroll halaman grup...`);

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await delay(2000);
  }

  const links = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll("a[href*='/groups/']").forEach(a=>{
      if(a.href.includes("groups") && a.href.split("/").length > 4){
        arr.push(a.href.split("?")[0]);
      }
    });

    return [...new Set(arr)];
  });

  console.log(`📊 [${accountName}] Total link grup: ${links.length}`);

  return links;
}


// ===============================
// SCRAPE DETAIL GROUP (NAMAMU)
// ===============================
async function scrapeGroupDetail(page, url, accountName){

  console.log(`➡️ [${accountName}] Buka grup: ${url}`);

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  await delay(5000);

  const groupInfo = await page.evaluate(() => {

    const rawTitle = document.title || "Unknown Group";
    const name = rawTitle
      .replace(/\s*\|\s*Facebook/i,"")
      .trim();

    const img =
      document.querySelector('img[alt*="cover"]') ||
      document.querySelector('img[role="img"]') ||
      document.querySelector('img[src*="scontent"]');

    return {
      name,
      photo: img ? img.src : null
    };
  });

  console.log(`✅ [SCRAPE] Nama: ${groupInfo.name}`);
  console.log(`🖼️ [SCRAPE] Foto: ${groupInfo.photo ? "ADA" : "TIDAK ADA"}`);

  return groupInfo;
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
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

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

    console.log(`✅ Login berhasil: ${accountData.account}`);
    console.log(`🌐 URL sekarang: ${page.url()}`);

    // ===============================
    // AMBIL LIST LINK GROUP
    // ===============================
    const links = await getGroupLinks(page, accountData.account);

    const groups = [];

    // ===============================
    // LOOP SETIAP GROUP
    // ===============================
    for (let i = 0; i < links.length; i++) {

      console.log(`\n🔎 [${accountData.account}] (${i+1}/${links.length})`);

      const info = await scrapeGroupDetail(
        page,
        links[i],
        accountData.account
      );

      groups.push({
        link: links[i],
        name: info.name,
        photo: info.photo,
        checked: false
      });

      console.log(`⏳ Tunggu 10 detik sebelum lanjut...`);
      await delay(10000);
    }

    allGroupsPerAccount[accountData.account] = groups;

    console.log(`\n📦 Selesai akun: ${accountData.account}`);
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
