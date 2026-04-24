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

  await page.goto("https://m.facebook.com/groups/", {
    waitUntil: "domcontentloaded"
  });

  console.log("🌐 REAL URL:", page.url());

  await page.waitForTimeout(5000);

  // =========================
  // 2️⃣ DETECT GROUP LINKS (DEBUG WAJIB)
  // =========================
  const hasGroups = await page.evaluate(() => {
    return document.querySelectorAll("a[href*='/groups/']").length;
  });

  console.log("🔎 DETECTED LINKS:", hasGroups);

  // =========================
  // 3️⃣ SCROLL UNTUK LOAD DATA
  // =========================
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(3000);
  }

  // =========================
  // 4️⃣ SCRAPE DATA SETELAH SCROLL
  // =========================
  const groups = await page.evaluate(() => {
    const result = [];

  //  const cards = document.querySelectorAll("div");
// ambil semua container card
  //const cards = document.querySelectorAll('div[data-mcomponent="MContainer"]');
    
  //  cards.forEach(card => {

    //  const a = card.querySelector("a[href*='/groups/']");
      //if (!a) return;

     // const href = a.href || "";
/// VERSI WEBSITE////
    // 🔥 FIX: pakai link bukan semua div
    const links = document.querySelectorAll("a[href*='/groups/']");

    links.forEach(a => {

      const match = a.href.match(/groups\/(\d+)/);
      const id = match ? match[1] : null;
      if (!id) return;
      
    ///// SAMPAI SINI////

    /////VERSI MOBILE///

    
    //  const name = card.innerText
       // ?.split("\n")
        //.find(t =>
          //t &&
          //t.length > 2 &&
        //  t.length < 80
       // )
       // ?.trim();

      //const img = card.querySelector("img");
      //const photo = img ? img.src : null;
      // FIX: AMBIL NAMA (pakai cara script 2)
    // =========================
   
   // NAMA (INI YANG BENAR dari inspect kamu)
  //  const name =
    // card.querySelector('h3 span')?.innerText?.trim() ||
    //  card.querySelector('h3')?.innerText?.trim() ||
     // null;
      // 🔥 FIX NAME (ambil dari card bukan title)
     
    ///VERSI WEBSITE 

const text = a.innerText.trim();

    // 🔥 FILTER KUNCI
    if (
      !text ||
     text === "Lihat Grup" ||
      !text.includes("Terakhir aktif")
  ) return;
const name = text.split('\n')[0];

    ////VERSI WEBSITE////
    
      // ================= COVER IMAGE =================
     website const img = a.querySelector('image, img');
// 🔥 foto


    ///mobile 
   /// const links = document.querySelectorAll('a[href*="/groups/"]');

 /// links.forEach(a => {
   /// const href = a.href;

   /// const match = href.match(/groups\/([^/?]+)/);
   /// if (!match) return;

  ///  const id = match[1];

  ///  const name = a.innerText?.split("\n")[0]?.trim();

  ///  if (
    //  !name ||
    ///  name === "Groups" ||
    ///  name === "Most visited" ||
   ///   name === "Login" ||
   ///   name.includes("Konten ini")
 ///   ) return;

    // ✅ FIX PHOTO
  ///  const img = a.querySelector("img");
   /// const photo = img ? img.src : null;

    
    let photo = null;
    if (img) {
      photo =
       img.getAttribute('xlink:href') ||
       img.getAttribute('src') ||
       img.getAttribute('data-src') ||
       img.src ||
        img.getAttribute('scontent') ||
       null;
    
      const imgs = card.querySelector('img');
 const photos =
      img?.getAttribute('src') ||
     img?.getAttribute('data-src') ||
      null;
      
      result.push({
        id,
        name: name || null,
        link: `https://m.facebook.com/groups/${id}`,
        photo
      });
    });

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


// MOBILE MODE
await page.setUserAgent(
  "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
);

await page.setViewport({
  width: 390,
  height: 844,
  isMobile: true
});
 // BARU recorder dibuat
//const recorder = new PuppeteerScreenRecorder(page);
//await recorder.start("video.mp4");
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
 
  
 // await recorder.stop();
  await browser.close();

  if (!fs.existsSync("./docs"))
    fs.mkdirSync("./docs");

  fs.writeFileSync(
    "./docs/groups.json",
    JSON.stringify(allGroupsPerAccount, null, 2)
  );
console.log("📁 FILE LOCATION: ./docs/groups.json");
console.log("✔ FILE SIZE:", fs.statSync("./docs/groups.json").size, "bytes");
  console.log("\n✅ groups.json berhasil dibuat");

})();
