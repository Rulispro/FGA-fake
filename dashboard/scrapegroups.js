const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");
puppeteer.use(StealthPlugin());

puppeteer.use(
  StealthPlugin({
    enabledEvasions: new Set([
      "navigator.webdriver"
    ])
  })
);

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

process.setMaxListeners(20);
// ============================
      
    
  



 async function getGroupLinks(page, accountName, existingIds = []){

  console.log(`📥 [${accountName}] Buka groups...`);

  await page.goto("https://m.facebook.com/groups/joins/", {
    waitUntil: "networkidle2"
  });

  console.log("🌐 REAL URL:", page.url());

  await page.waitForTimeout(9000);

  // =========================
  // 2️⃣ DETECT GROUP LINKS
  // =========================
  const hasGroups = await page.evaluate(() => {
    return document.querySelectorAll("a[href*='/groups/']").length;
  });

  console.log("🔎 DETECTED LINKS:", hasGroups);

  // 🔥 PENAMPUNG DATA BARU
  const collected = [];

  // =========================
  // 3️⃣ SCROLL UNTUK LOAD DATA
  // =========================
 
   for (let i = 0; i < 20; i++) {
     console.log(`Scroll ${i + 1}`);
     
await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
  });
   await delay(2000);

 ////   await page.evaluate(() => {
   ///   window.scrollTo(0, document.body.scrollHeight);
  ///  });

// 🔥 force DOM re-render (INI YANG KAMU MAKSUD RETRY)
//await page.evaluate(() => {
 // window.scrollBy(0, 300);
//});
      //  await delay(4000 + Math.random() * 4000);

    
// 2. center elements
/////await page.evaluate(() => {
  ////document.querySelectorAll("a[href*='/groups/']")
  ////  .forEach(a => a.scrollIntoView({ block: "center" }));
////});

///await page.waitForTimeout(1500);
    await page.waitForTimeout(2500);
    
    // =========================
    // SCRAPE PER SCROLL
    // =========================
    const newData = await page.evaluate(() => {
       // 🔥 FORCE DOM STABILIZATION
    const result = [];

      const links = document.querySelectorAll("a[href*='/groups/']");
      
      
      links.forEach(a => {

        const match = a.href.match(/groups\/(\d+)/);
        if (!match) return;

        const id = match[1];

        const rawText = a.innerText.trim();
        const text = rawText.toLowerCase();

        // skip UI button
        if (
          !text ||
          text.includes("lihat grup") ||
          text.includes("view group") ||
          text.includes("gabung") ||
          text.includes("join")
        ) return;

        const name = rawText.split('\n')[0];

        // ================= PHOTO =================
        let photo = null;

        
// 🔥 1. AMBIL DARI PARENT CONTAINER (INI FIX UTAMA)
const container =
  a.closest('div[role="article"]') ||
  a.closest('div') ||
  document;
        
  // 🔥 SVG IMAGE (BEST VERSION)
const svgImages = a.querySelectorAll("svg image");
    

svgImages.forEach(img => {
  if (!photo) {
    const url =
      img.href?.baseVal ||
      img.getAttribute("href") ||
      img.getAttribute("xlink:href");

    if (url && url.includes("scontent")) {
      photo = url;
      console.log("🔥 SVG FINAL:", url);
    }
  }
});

if (!photo) {
  const img =
    a.querySelector("img") ||
    a.querySelector("image") ||
    a.closest("div")?.querySelector("img");

  if (img && img.src && img.src.includes("scontent")) {
    photo = img.src;
    console.log("🔥 IMG:", photo);
  }
}
// 2. IMG HTML
// =======================
 
    if (!photo) {
  const img =
    a.querySelector("img") ||
    a.querySelector("image") ||
    a.querySelector("svg image") ||
    a.closest("div")?.querySelector("img") ||
    document.querySelector(`a[href*="/groups/${id}"] img`);

  if (img) {
    const src =
      img.src ||
      img.getAttribute("href") ||
      img.getAttribute("xlink:href");

    if (src && src.includes("scontent")) {
      photo = src;
      console.log("🔥 IMG FIX:", photo);
    }
  }
      }
        

 // 3. ROLE IMG (BG)
// =======================
if (!photo) {
  const roleImg = a.querySelector('[role="img"]');

  if (roleImg) {
    const bg = window.getComputedStyle(roleImg).backgroundImage;

    const match = bg.match(/url\(["']?(.+?)["']?\)/);

    if (match && match[1] && match[1].includes("fbcdn")) {
      photo = match[1];
      console.log("🔥 BG ROLE:", photo);
    }
  }
}
        
        
        
// ================= FALLBACK GLOBAL SCAN =================
if (!photo) {
  const globalImg = document.querySelector(
    `a[href*="/groups/${id}"] img`
  );

  if (globalImg && globalImg.src) {
    photo = globalImg.src;
    console.log("🔥 GLOBAL FALLBACK IMG:", photo);
  }
}
  if (!photo) {
  console.log("❌ PHOTO NULL:", id);
  console.log("TEXT:", name);

  // 🔍 semua element dalam <a>
  const all = a.querySelectorAll("*");

  all.forEach(el => {
    const tag = el.tagName;

    // ambil semua attribute
    const attrs = {};
    for (let attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }

    // cek src / href penting
    const src =
      el.src ||
      el.getAttribute("src") ||
      el.getAttribute("data-src") ||
      el.getAttribute("data-img") ||
      el.getAttribute("xlink:href") ||
      el.getAttribute("href") ||
      null;

    // cek background
    const bg = window.getComputedStyle(el).backgroundImage;

    // filter biar gak spam kosong
    if (src || (bg && bg.includes("url"))) {
      console.log("----- ELEMENT -----");
      console.log("TAG:", tag);
      console.log("SRC/HREF:", src);

      if (bg && bg.includes("url")) {
        console.log("BG:", bg);
      }

      console.log("ATTR:", attrs);

      // 🔥 deteksi CDN FB
      if (src && src.includes("fbcdn")) {
        console.log("🔥 FB CDN IMAGE DETECTED:", src);
      }
    }
  });

  console.log("=================================");
      }

        
        result.push({
          id,
          name,
          link: `https://m.facebook.com/groups/${id}`,
          photo
        });
      });

      return result;
    });

    // =========================
    // FILTER HANYA YANG BARU
    // =========================
    const fresh = newData.filter(g => {
  const existing = collected.find(c => c.id === g.id);

  if (!existing) return true;

  // 🔥 update kalau photo sebelumnya null
  if (!existing.photo && g.photo) {
    existing.photo = g.photo;
  }

  return false;
});
    

    collected.push(...fresh);

    console.log(`🆕 baru: ${fresh.length}`);
    console.log(`📦 total: ${collected.length}`);

    // 🔥 STOP kalau sudah 100
    if (collected.length >= 100) {
      console.log("🛑 Stop, sudah 100 grup");
      break;
    }
  }

  console.log(`📊 Total grup diambil: ${collected.length}`);

  return collected.slice(0, 100);
              }


// ===============================
// MAIN
// ===============================
(async () => {

  const accounts = JSON.parse(
  fs.readFileSync("./dashboard/accounts.json")
).filter(acc =>
  acc.account &&
  acc.cookies &&
  acc.cookies.some(c => c.name === "c_user" && c.value)
);

  let existingGroups = {};

if (fs.existsSync("./docs/groups.json")) {
  existingGroups = JSON.parse(
    fs.readFileSync("./docs/groups.json", "utf8")
  );
}
  
   const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/usr/bin/chromium-browser",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-features=site-per-process",
    "--disable-extensions",
    "--no-first-run"
  ],
  timeout: 120000
});
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('🌐 PAGE LOG:', msg.text()));
  page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(120000);

  await delay(4000); // 🔥 penting

//setuseragent 
  await page.setUserAgent(
 // 
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
);

 await page.setViewport({
  width: 1366,
  height: 768,
  isMobile: false
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
async function safeEval(page, fn) {
  try {
    return await page.evaluate(fn);
  } catch (e) {
    return null;
  }
 }
  

  

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
    const oldGroups = existingGroups[accountData.account] || [];

const groups = await getGroupLinks(
  page,
  accountData.account,
  oldGroups.map(g => g.id)
);
    
    // DEBUG HTML (optional)
    fs.writeFileSync(`debug-${accountData.account}.html`, await page.content());

    
    
// ambil hanya group baru
const newOnly = groups.filter(g =>
  !oldGroups.some(o => o.id === g.id)
);

// gabungkan lama + baru
const merged = [...oldGroups, ...newOnly];

// simpan TANPA limit (biar nambah terus)
existingGroups[accountData.account] = merged;
allGroupsPerAccount[accountData.account] = merged;

    console.log(`📦 Selesai akun: ${accountData.account}`);
    console.log(`🆕 New groups: ${newOnly.length}`);
console.log(`📦 Total cached (before limit): ${merged.length}`);
console.log(`📦 Total cached/save: ${merged.length}`);
    console.log("⏭ Pindah akun berikutnya...\n");

    await delay(5000);
  }
 
  
 // await recorder.stop();
  await browser.close();

  if (!fs.existsSync("./docs"))
    fs.mkdirSync("./docs");

  fs.writeFileSync(
  "./docs/groups.json",
  JSON.stringify(existingGroups, null, 2)
);

  
console.log("📁 FILE LOCATION: ./docs/groups.json");
console.log("✔ FILE SIZE:", fs.statSync("./docs/groups.json").size, "bytes");
  console.log("\n✅ groups.json berhasil dibuat");

})();
