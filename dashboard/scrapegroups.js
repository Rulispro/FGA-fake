const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ===============================
// SCRAPE GROUP LIST
// ===============================
async function scrapeMyGroups(page) {

  console.log("📥 Ambil daftar grup...");

  await page.goto("https://m.facebook.com/groups/", {
    waitUntil: "networkidle2"
  });

  await delay(5000);

  // scroll
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await delay(2000);
  }

  const groups = await page.evaluate(() => {

    const results = [];

    const links = document.querySelectorAll("a[href*='/groups/']");

    links.forEach(el => {
      const link = el.href;
      const name = el.innerText?.trim();

      if (!name || name.length < 3) return;

      const img = el.querySelector("img")?.src || null;

      results.push({
        name,
        link,
        photo: img,
        checked: false
      });
    });

    // remove duplicate
    const unique = [];
    const seen = new Set();

    for (const g of results) {
      if (!seen.has(g.link)) {
        seen.add(g.link);
        unique.push(g);
      }
    }

    return unique;
  });

  return groups;
}

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

    console.log("✅ Login:", accountData.account);

    const groups = await scrapeMyGroups(page);

    allGroupsPerAccount[accountData.account] = groups;

    await delay(3000);
  }

  await browser.close();

  if (!fs.existsSync("./docs"))
    fs.mkdirSync("./docs");

  fs.writeFileSync(
    "./docs/groups.json",
    JSON.stringify(allGroupsPerAccount, null, 2)
  );

  console.log("✅ groups.json berhasil dibuat");

})();
