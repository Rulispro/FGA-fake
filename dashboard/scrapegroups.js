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

  console.log(`🌐 URL sekarang: ${page.url()}`);

  console.log(`⏳ Tunggu 5 detik...`);
  await delay(5000);

  // ===============================
  // SCROLL (WAJIB - lazy load)
  // ===============================
  console.log(`📜 Scroll halaman...`);

  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await delay(2000);
  }

  // ===============================
  // SCRAPE DATA LANGSUNG DARI LIST
  // ===============================
  const groups = await page.evaluate(() => {

    const result = [];

    // Ambil semua kemungkinan container item
    const items = document.querySelectorAll('a, div[role="link"]');

    items.forEach(el => {

      const text = el.innerText || "";

      // Filter: item grup biasanya ada kata "post"
      if (
        text.toLowerCase().includes("post")
      ) {

        const lines = text.split("\n").map(t => t.trim()).filter(Boolean);

        // Nama grup biasanya baris pertama
        const name = lines[0];

        // Ambil foto
        const img = el.querySelector("img");

        // Ambil link kalau ada
        const link = el.closest("a")?.href || null;

        // Validasi biar ga ambil sampah
        if (name && name.length > 3) {
          result.push({
            name,
            photo: img ? img.src : null,
            link
          });
        }
      }
    });

    // Hapus duplikat berdasarkan nama
    const unique = [];
    const seen = new Set();

    result.forEach(g => {
      if (!seen.has(g.name)) {
        seen.add(g.name);
        unique.push(g);
      }
    });

    return unique;
  });

  console.log(`📊 Total grup: ${groups.length}`);

  if(groups.length === 0){
    console.log("⚠️ WARNING: Tidak ada grup keambil");
  }

  return groups;
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

    await delay(4000);
    console.log(`⏳ Tunggu 4 detik sebelum lanjut...`);
    console.log(`✅ Login berhasil: ${accountData.account}`);
    console.log(`🌐 URL sekarang: ${page.url()}`);

    // ===============================
    // AMBIL LIST LINK GROUP
    // ===============================
    const groups = await getGroupLinks(page, accountData.account);
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
