"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const XLSX = require("xlsx");   
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");

puppeteer.use(
  StealthPlugin({
    enabledEvasions: new Set([
      "navigator.webdriver"
    ])
  })
);

const groupsDB = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "groups.json"),
    "utf8"
  )
);
//load dari docs/selected.json
const selectedData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "docs", "selected.json"),
    "utf8"
  )
);

const docsDir = path.join(__dirname, "docs");
const dataPath = path.join(docsDir, "data.json");

// 1. Pastikan folder ada
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// 2. Load data lama (kalau ada)
let docsData = [];

if (fs.existsSync(dataPath)) {
  try {
    docsData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    // 🛡️ jaga kalau file rusak
    if (!Array.isArray(docsData)) {
      docsData = [];
    }

  } catch (err) {
    console.log("⚠️ data.json rusak, reset ulang");
    docsData = [];
  }

} else {
  // 3. Kalau belum ada → buat file kosong SEKALI
  fs.writeFileSync(dataPath, JSON.stringify([], null, 2));
}

//Parser jam 👇//
function cocokJam(rowJam) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );

  const [h, m] = rowJam.split(":").map(Number);

  const target = new Date(now);
  target.setHours(h, m, 0, 0);

  const selisih = Math.abs(now - target) / 1000 / 60; // menit

  return selisih <= 180; // toleransi 180 menit (3 jam)
}
//sampai sini 👆///

//ACAK AKUN
function shuffleArray(arr) {
  const shuffled = [...arr];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const rand = crypto.randomBytes(4).readUInt32BE(0);
    const j = rand % (i + 1);

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

//NORMALISASI TANGGAL DOCS/SELECTED.JSON

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function normalizeTanggal(tgl) {
  if (!tgl) return "";

  if (tgl.includes("/")) {
    const [d, m, y] = tgl.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return tgl;
}

//HELPER ISI CAPTION 
async function clearComposer(page) {
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);
}


async function typeCaptionFB(page,
  caption,
  delayMikir,
  delayKetikMin,
  delayKetikMax,
  pauseChance,
  pauseMin,
  pauseMax) {
  delayMikir = Number(delayMikir);
  delayKetikMin = Number(delayKetikMin);
  delayKetikMax = Number(delayKetikMax);
  pauseChance = Number(pauseChance);
  pauseMin = Number(pauseMin);
  pauseMax = Number(pauseMax);

  console.log("✍️ Ketik caption (FB stable)");

  // 1️⃣ Tunggu overlay loading hilang
  await page.waitForFunction(() => {
    return !(
      document.querySelector('[aria-label="Loading"]') ||
      document.querySelector('[aria-busy="true"]') ||
      document.querySelector('div[role="dialog"]')
    );
  }, { timeout: 30000 });

  // 2️⃣ Bangunin editor (WAJIB di FB)
  await page.keyboard.type(" ");
  await page.waitForTimeout(150);
  await page.keyboard.press("Backspace");

  await page.waitForTimeout(delayMikir);
  
  // 3️⃣ Ketik caption ala manusia
  for (const ch of caption) {

    const delayHuruf =
      Math.floor(Math.random() * (delayKetikMax - delayKetikMin + 1)) + delayKetikMin;

    await page.keyboard.type(ch, { delay: delayHuruf });

    // pause random dari XLSX
    if (Math.random() < pauseChance) {
      const pause =
        Math.floor(Math.random() * (pauseMax - pauseMin + 1)) + pauseMin;

      await page.waitForTimeout(pause);
    }
 }

  // 4️⃣ Commit React
  await page.keyboard.press("Space");
  await page.keyboard.press("Backspace");

  console.log("✅ Caption berhasil diketik captiontypeFB");

return { ok: true, method: "typeCaptionFB" };

}

//Validasinya 
async function validateCaption(page, caption) {
  return await page.evaluate(text => {
    const el =
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea');

    if (!el) return false;

    const domVal =
      el.textContent ||
      el.innerText ||
      el.value ||
      "";

    const dataText = el.getAttribute("data-text") || "";

    return (
      domVal.includes(text.slice(0, 3)) ||
      dataText.includes(text.slice(0, 3))
    );
  }, caption);
}

//ISI CAPTION type manusia tahan update 
async function typeCaptionStable(page, caption) {
  let typed = false;

  try {
    await page.evaluate(() => {
      const candidates = [
        '[role="textbox"]',
        '[role="combobox"]',
        'textarea',
        'div[contenteditable="true"]',
        '[aria-label*="Tulis sesuatu"]',
        '[aria-label*="Write something"]'
      ];

      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          return true;
        }
      }
      return false;
    });

    await page.waitForTimeout(1500);

    const focused = await page.evaluate(() => {
      const els = document.querySelectorAll(
        'div[contenteditable="true"], textarea'
      );
      for (const el of els) {
        el.click();
        el.focus();
        if (document.activeElement === el) return true;
      }
      return false;
    });

    if (!focused) {
      return { ok: false, typed: false, step: "focus_failed" };
    }

    typed = true;
    for (const char of caption) {
      await page.keyboard.type(char, {
        delay: 80 + Math.random() * 120
      });

      if (Math.random() < 0.05) {
        await page.waitForTimeout(300 + Math.random() * 600);
      }
    }

    await page.waitForTimeout(800);
    await page.keyboard.press("Space");
    await page.keyboard.press("Backspace");

    const ok = await validateCaption(page, caption);

    if (ok) {
      return { ok: true, typed: true, step: "stable_ok" };
    }

    return { ok: false, typed: true, step: "validation_failed" };

  } catch (err) {
    return { ok: false, typed, step: "exception", error: err.message };
  }
}

//isi caption klik placeholder 
async function activateComposerAndFillCaption(page, caption) {
  return await page.evaluate((text) => {
    const placeholderKeywords = [
      "write something",
      "tulis sesuatu",
      "buat postingan publik",
      "create a public post",
      "kirim postingan buat persetujuan admin",
      "submit a post for admin"
    ];

    const btn = [...document.querySelectorAll("div[role='button']")]
      .find(el => {
        const t = (el.innerText || "").toLowerCase();
        return placeholderKeywords.some(k => t.includes(k));
      });

    if (btn) {
      ["mousedown", "mouseup", "click"].forEach(type =>
        btn.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window
          })
        )
      );
    }

    const selectors = [
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea"
    ];
    for (const s of selectors) {
      const tb = document.querySelector(s);
      if (!tb) continue;

      tb.focus();

      if ("value" in tb) {
        tb.value = "";
      } else {
        tb.innerText = "";
        tb.textContent = "";
      }

      if ("value" in tb) {
        tb.value = text;
        tb.dispatchEvent(new Event("input", { bubbles: true }));
        tb.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        tb.innerText = text;
        tb.dispatchEvent(new InputEvent("input", { bubbles: true }));
        tb.dispatchEvent(new Event("change", { bubbles: true }));
      }

      return {
        ok: true,
        step: "activate+fill",
        selector: s
      };
    }

    return {
      ok: false,
      step: "textbox_not_found"
    };
  }, caption);
}

async function typeByExecCommand(page, caption) {
  await page.evaluate(text => {
    const el = document.querySelector(
      'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea'
    );
    if (!el) return;
    el.focus();
    document.execCommand("insertText", false, text);
  }, caption);
}

async function typeByInputEvents(page, caption) {
  const selector = 'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea';
  
  const focused = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    el.click();
    const selObj = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selObj.removeAllRanges();
    selObj.addRange(range);
    return document.activeElement === el;
  }, selector);

  if (!focused) {
    return false;
  }

  for (const char of caption) {
    await page.evaluate((ch, sel) => {
      const el = document.querySelector(sel);
      if (!el) return;

      document.execCommand("insertText", false, ch);
      const beforeEvt = new InputEvent("beforeinput", { inputType: "insertText", data: ch, bubbles: true, cancelable: true });
      const inputEvt = new InputEvent("input", { inputType: "insertText", data: ch, bubbles: true });

      el.dispatchEvent(beforeEvt);
      el.dispatchEvent(inputEvt);
    }, char, selector);

    await page.waitForTimeout(50 + Math.random() * 80);
  }

  await page.keyboard.press("Space");
  await page.keyboard.press("Backspace");

  const ok = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return false;
    return (el.innerText && el.innerText.trim().length > 0);
  }, selector);

  return ok;
}

async function typeByKeyboard(page, caption) {
  await page.waitForTimeout(800 + Math.random() * 1200);
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300 + Math.random() * 400);

  for (const char of caption) {
    await page.keyboard.type(char, {
      delay: 80 + Math.random() * 70
    });

    if (Math.random() < 0.1) {
      await page.waitForTimeout(400 + Math.random() * 900);
    }
  }
}

async function typeCaptionUltimate(page,
  caption,
  delayMikir,
  delayKetikMin,
  delayKetikMax,
  pauseChance,
  pauseMin,
  pauseMax) {
  
  let fbResult;
  try {
    fbResult = await typeCaptionFB(
      page,
      caption,
      delayMikir,
      delayKetikMin,
      delayKetikMax,
      pauseChance,
      pauseMin,
      pauseMax
    );
  } catch (e) {}

  if (fbResult?.ok) {
    return fbResult;
  }
     
  const stable = await typeCaptionStable(page, caption);
  if (stable?.ok) {
    return stable;
  }

  if (stable?.typed) {
    return { ok: true, method: "StableTyped" };
  }
  
  const comboResult = await activateComposerAndFillCaption(page, caption);
  await page.waitForTimeout(2000);

  if (comboResult?.ok) {
    return;
  }

  await clearComposer(page);
  try {
    await typeCaptionSafe(page, caption);
    await page.waitForTimeout(400);
    if (await validateCaption(page, caption)) {
      return;
    }
  } catch (e) {} 

  const methods = [
    { name: "Keyboard", fn: typeByKeyboard },
    { name: "ExecCommand", fn: typeByExecCommand },
    { name: "InputEvent", fn: typeByInputEvents }
  ];

  for (const m of methods) {
    await clearComposer(page);
    try {
      await m.fn(page, caption);
    } catch (err) {
      continue;
    }

    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    await page.keyboard.press("Backspace");

    if (await validateCaption(page, caption)) {
      return;
    }
  }

  return { ok: false, reason: "caption_blocked" };
}

async function typeCaptionSafe(page, caption) {
  const selector = 'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea';

  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);

  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) el.focus();
  }, selector);

  await page.waitForTimeout(200);
  await page.keyboard.type(caption, { delay: 90 });
  await page.waitForTimeout(600);
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseTanggalXLSX(tgl) {
  if (!tgl) return null;

  if (typeof tgl === "string" && tgl.includes("-")) {
    return tgl.slice(0, 10);
  }

  if (typeof tgl === "string" && tgl.includes("/")) {
    const parts = tgl.split("/");

    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }

    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    const [m, d, y] = parts;
    const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);

    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

// ====== RUN LIKELINKPOST ======
async function runLikeLinkPosts(page, row) {
  const account = row.account;
  const total = Number(row.total) || 1;
  const delayMin = Number(row.delay_min) || 4000;
  const delayMax = Number(row.delay_max || 8000);

  const groups = String(row.link_group || "")
    .split(",")
    .map(g => g.replace(/[\s\r\n]+/g, "").trim())
    .filter(Boolean);

  if (!account || groups.length === 0) return;

  for (let i = 0; i < groups.length; i++) {
    let groupUrl = groups[i];
    if (!groupUrl.startsWith("http")) {
      groupUrl = "https://m.facebook.com/" + groupUrl.replace(/^\/+/, "");
    }
    await linkPost(page, groupUrl, total, delayMin, delayMax);
  }
}

async function linkPost(page, groupUrl, total, delayMin, delayMax) {
  try {
    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    let clicked = 0;
    while (clicked < total) {
      const liked = await page.evaluate(() => {
        function humanClick(el) {
          el.scrollIntoView({ block: "center" });
          ["pointerdown","touchstart","mousedown","mouseup","touchend","click"]
            .forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true })));
        }

        const btn = [...document.querySelectorAll('div[role="button"]')]
          .find(el => {
            const label = (el.getAttribute("aria-label") || "").toLowerCase();
            return label.includes("like") || label.includes("suka");
          });

        if (!btn) return false;
        humanClick(btn);
        return true;
      });

      if (!liked) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(3000);
        continue;
      }

      clicked++;
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      await page.waitForTimeout(delay);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.5));
    }
  } catch (err) {}
}

//FUNGSI LIKELINKGROUP
async function runLikeLinkGroups(page, row) {
  const account = row.account;
  const total = Number(row.total || 0);
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);

  if (!account || total <= 0) return;

  const groups = String(row.link_group || "")
    .split(",")
    .map(g => g.replace(/[\s\r\n]+/g, "").trim())
    .filter(Boolean);

  if (groups.length === 0) return;

  for (let i = 0; i < groups.length; i++) {
    let groupUrl = groups[i];
    if (!groupUrl.startsWith("http")) {
      groupUrl = "https://m.facebook.com/" + groupUrl.replace(/^\/+/, "");
    }

    if (!groupUrl.includes("/groups/")) continue;

    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    let clicked = 0;
    while (clicked < total) {
      const liked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('div[role="button"]')]
          .find(el => {
            const label = (el.getAttribute("aria-label") || "").toLowerCase();
            return label.includes("like") || label.includes("suka");
          });

        if (!btn) return false;
        btn.scrollIntoView({ block: "center" });
        btn.click();
        return true;
      });

      if (!liked) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await page.waitForTimeout(2000);
        continue;
      }

      clicked++;
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      await page.waitForTimeout(delay);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.6));
      await page.waitForTimeout(2000);
    }
  }
}

//FUNGSI UNDFRIEND 
async function runUndfriends(page, row) {
  const total = String(row.total || "").trim();
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);
  
  if (!total) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('div[role="button"]')]
      .find(el => {
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        return label.includes("profil") || label.includes("profile");
      });
    if (btn) btn.click();
  });

  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const target = spans.find(s => {
      const t = (s.innerText || "").trim().toLowerCase();
      if (!t || /^\d+$/.test(t)) return false;
      return t === "following" || t === "mengikuti";
    });
    if (target) target.click();
  });

  await page.waitForTimeout(2000);
  await unfriend(page, total, delayMin, delayMax);
}

async function unfriend(page, total, delayMin, delayMax) {
  try {
    const LIMIT = Number(total) || 1;
    let done = 0;

    await page.waitForTimeout(3000);

    while (done < LIMIT) {
      const step1 = await page.evaluate(() => {
        const tab = [...document.querySelectorAll('[role="tab"]')]
          .find(el => {
            const label = (el.getAttribute("aria-label") || "").toLowerCase();
            return label.includes("friends") || label.includes("teman");
          });
        if (!tab) return false;
        tab.click();
        return true;
      });

      if (!step1) break;
      await page.waitForTimeout(2000);

      const step2 = await page.evaluate(() => {
        const menu = [...document.querySelectorAll('[role="button"]')]
          .find(el => {
            const label = (el.getAttribute("aria-label") || "").toLowerCase();
            return label.includes("friend settings") || label.includes("pengaturan teman");
          });
        if (!menu) return false;
        menu.click();
        return true;
      });

      if (!step2) break;
      await page.waitForTimeout(2000);

      const step3 = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("span")]
          .find(el => {
            const t = (el.innerText || "").toLowerCase();
            return t.includes("unfriend") || t.includes("hapus pertemanan");
          });
        if (!btn) return false;
        btn.click();
        return true;
      });

      if (!step3) break;
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        const confirmBtn = [...document.querySelectorAll('[role="button"] span')]
          .find(el => {
            const t = (el.innerText || "").toLowerCase();
            return t === "unfriend" || t === "hapus pertemanan";
          });
        if (confirmBtn) confirmBtn.click();
      });

      done++;
      const delay = randomDelay(delayMin, delayMax);
      await page.waitForTimeout(delay);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await page.waitForTimeout(2000);
    }
  } catch (err) {}
}

//FUNGSI addFriendFollowing
async function runAddFriendFollowings(page, row) {
  const total = String(row.total || "").trim();
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);
  const linkTargetUsernameUrl = String(row.link_targetUsername || "").trim();
  
  if (!total || !linkTargetUsernameUrl) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);

  await page.goto(linkTargetUsernameUrl, { waitUntil: "networkidle2" });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const target = spans.find(s => {
      const t = (s.innerText || "").trim().toLowerCase();
      if (!t || /^\d+$/.test(t)) return false;
      return t === "following" || t === "mengikuti";
    });
    if (target) target.click();
  });

  await page.waitForTimeout(2000);
  await addFriendByUsernameFollowing(page, total, delayMin, delayMax);
}

async function addFriendByUsernameFollowing(page, total, delayMin, delayMax) {
  try {
    const LIMIT = Number(total) || 0;
    if (LIMIT <= 0) return;

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    let clicked = 0;
    while (clicked < LIMIT) {
      const found = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('div[role="button"]')]
          .filter(btn => {
            const text = (btn.innerText || "").toLowerCase();
            const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
            return text.includes("add friend") || text.includes("tambah teman") || aria.startsWith("send a friend request");
          });

        const listButtons = buttons.slice(1);
        for (const btn of listButtons) {
          if (btn.dataset.clicked) continue;
          btn.dataset.clicked = "true";
          btn.click();
          return true;
        }
        return false;
      });

      if (!found) break;
      clicked++;
      const delay = randomDelay(delayMin, delayMax);
      await page.waitForTimeout(delay);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await page.waitForTimeout(3000);
    }
  } catch (err) {}
}

//FUNGSI addFriendFriendlist 
async function runAddFriendFriends(page, row) {
  const total = String(row.total || "").trim();
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);
  const linkTargetUsernameUrl = String(row.link_targetUsername || "").trim();
  
  if (!total || !linkTargetUsernameUrl) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);

  await page.goto(linkTargetUsernameUrl, { waitUntil: "networkidle2" });
  await page.waitForTimeout(3000);

  const okFriends = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const target = spans.find(s => {
      const t = (s.innerText || "").trim().toLowerCase();
      if (!t || /^\d+$/.test(t)) return false;
      return t === "friends" || t === "teman";
    });
    if (!target) return false;
    target.click();
    return true;
  });

  if (okFriends) {
    await page.waitForTimeout(2000);
    await addFriendByUsernameFollowing(page, total, delayMin, delayMax);
  }
}

//FUNGSI confirm 
async function runConfirm(page, row) {
  const total = String(row.total || "").trim();
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);
  
  if (!total) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);
  await page.goto("https://m.facebook.com/friends/");
  await confirmFriendRequests(page, total, delayMin, delayMax);
}

async function confirmFriendRequests(page, total, delayMin, delayMax) {
  let clicked = 0;
  while (clicked < total) {
    const buttons = await page.$x(
      "//div[@role='button']//span[" +
        "contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'konfirmasi')" +
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'confirm')" +
        "]/ancestor::div[@role='button']"
    );

    if (!buttons.length) break;
    await buttons[0].click();
    clicked++;
    const delay = randomDelay(delayMin, delayMax);
    await page.waitForTimeout(delay);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.35));
    await page.waitForTimeout(1000);
  }
}

//FUNGSI addFriendFollowers 
async function runAddFriendFollowers(page, row) {
  const total = String(row.total || "").trim();
  const delayMin = Number(row.delay_min || 4000);
  const delayMax = Number(row.delay_max || 8000);
  const linkTargetUsernameUrl = String(row.link_targetUsername || "").trim();
  
  if (!total || !linkTargetUsernameUrl) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);
  await page.goto(linkTargetUsernameUrl, { waitUntil: "networkidle2" });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const target = spans.find(s => {
      const t = (s.innerText || "").toLowerCase();
      return t.includes("followers") || t.includes("pengikut");
    });
    if (target) target.click();
  });

  await page.waitForTimeout(3000);
  await addFriendByUsernameFollowing(page, total, delayMin, delayMax);
}

//FUNGSI POSTING STATUS 
async function runStatus(page, row) {
  const account = row.account;
  const caption = row.caption;
  const mediaUrl = row.media_url || row.github_release;
  const delayMikir = Number(row.delay_mikir);
  const delayKetikMin = Number(row.delay_ketik_min);
  const delayKetikMax = Number(row.delay_ketik_max);
  const pauseChance = Number(row.pause_chance);
  const pauseMin = Number(row.pause_min);
  const pauseMax = Number(row.pause_max);

  if (!caption && !mediaUrl) return;

  await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
  await delay(3000);
  
  await page.waitForSelector('div[role="button"][data-mcomponent="ServerTextArea"]', { timeout: 20000 });
  await page.evaluate(() => {
    const el = document.querySelector('div[role="button"][data-mcomponent="ServerTextArea"]');
    if (el) el.click();
  });

  await page.waitForTimeout(2000);

  const boxHandle = await page.evaluateHandle(() => {
    return document.querySelector('div[contenteditable="true"][role="textbox"]') || 
           document.querySelector('div[contenteditable="true"]') || 
           document.querySelector('textarea');
  });
  
  const box = boxHandle.asElement();
  if (box) {
    await box.focus();
    await typeCaptionUltimate(page, caption, delayMikir, delayKetikMin, delayKetikMax, pauseChance, pauseMin, pauseMax);
  }

  await delay(3000);

  if (mediaUrl) {
    const originalName = mediaUrl.split("?")[0].split("/").pop();
    const fileName = `${account}_${Date.now()}_${originalName}`;
    const filePath = await downloadMedia(mediaUrl, fileName);
    await uploadMedia(page, filePath, fileName);
  }

  await page.evaluate(() => {
    const keywords = ["post", "posting", "bagikan"];
    const buttons = [...document.querySelectorAll('div[role="button"]')];
    const postBtn = buttons.find(btn => {
      const text = (btn.innerText || "").toLowerCase();
      return keywords.some(k => text.includes(k));
    });
    if (postBtn) postBtn.click();
  });

  await delay(3000);
}

//--FUNGSI RUN ACCOUNT--//
async function runAccount(page, row, accountName, today) {
  const account = row.account;
  const caption = row.caption;
  const mediaUrl = row.media_url || row.github_release;
  const delayMikir = Number(row.delay_mikir);
  const delayKetikMin = Number(row.delay_ketik_min);
  const delayKetikMax = Number(row.delay_ketik_max);
  const pauseChance = Number(row.pause_chance);
  const pauseMin = Number(row.pause_min);
  const pauseMax = Number(row.pause_max);

  const accountNameClean = accountName || row.account;
  const selectedGroupsRaw = Object.entries(selectedData).find(
    ([key]) => normalizeName(key) === normalizeName(accountNameClean)
  )?.[1] || [];

  const selectedGroups = selectedGroupsRaw.filter(
    g => normalizeTanggal(g.tanggal) === today
  );

  if (!account || !caption || !mediaUrl || selectedGroups.length === 0) return;

  for (let i = 0; i < selectedGroups.length; i++) {
    let groupUrl = selectedGroups[i].group_link;
    const groupData = groupsDB[groupUrl] || {};

    if (!groupUrl.startsWith("http")) {
      groupUrl = "https://m.facebook.com/" + groupUrl.replace(/^\/+/, "");
    }

    if (!groupUrl.includes("/groups/")) continue;

    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    docsData.push({
      account: row.account,
      tanggal: today,
      jam_post: row.jam_post,
      mode: "group",
      group_link: groupUrl,
      group_name: groupData.name || groupUrl,
      group_photo: groupData.photo || null,
      caption: row.caption,
      delay_group: row.delay_grup,
      delay_akun: row.delay_akun,
      status: "done"
    });

    await page.waitForTimeout(2000);
    
    await page.waitForSelector('div[role="button"][data-mcomponent="ServerTextArea"]', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => {
      const el = document.querySelector('div[role="button"][data-mcomponent="ServerTextArea"]');
      if (el) el.click();
    });

    await page.waitForTimeout(2000);
    await typeCaptionUltimate(page, caption, delayMikir, delayKetikMin, delayKetikMax, pauseChance, pauseMin, pauseMax);
    await delay(3000);

    const originalName = mediaUrl.split("?")[0].split("/").pop();
    const fileName = `${account}_${Date.now()}_${originalName}`;
    const filePath = await downloadMedia(mediaUrl, fileName);
    await uploadMedia(page, filePath, fileName);

    await page.evaluate(() => {
      const keywords = ["post", "posting", "bagikan"];
      const buttons = [...document.querySelectorAll('div[role="button"]')];
      const postBtn = buttons.find(btn => {
        const text = (btn.innerText || "").toLowerCase();
        return keywords.some(k => text.includes(k));
      });
      if (postBtn) postBtn.click();
    });

    await delay(3000);
  }
}

// ===== FUNGSI DOWNLOAD MEDIA =====
async function downloadMedia(url, filename) {
  const mediaFolder = path.join(__dirname, "media");
  if (!fs.existsSync(mediaFolder)) fs.mkdirSync(mediaFolder, { recursive: true });

  const filePath = path.join(mediaFolder, filename);
  const options = { headers: { "User-Agent": "Mozilla/5.0 (PuppeteerBot)" } };

  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadMedia(res.headers.location, filename));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Gagal download media: ${res.statusCode}`));
      }

      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(filePath)));
    }).on("error", reject);
  });
}

// ===== FUNGSI UPLOAD MEDIA =====
async function uploadMedia(page, filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const isVideo = [".mp4", ".mov"].includes(ext);

  try {
    if (isVideo) {
      await page.evaluate(() => {
        const span = [...document.querySelectorAll("span")].find(s => s.textContent && s.textContent.trim().toLowerCase() === "video");
        if (span) {
          const btn = span.closest('div[role="button"], button');
          if (btn) btn.click();
        }
      });
    } else {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('div[role="button"]')];
        const btn = buttons.find(b => (b.innerText || "").toLowerCase().includes("foto"));
        if (btn) btn.click();
      });
    }
  } catch (e) {}

  await page.waitForTimeout(2000);
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) return false;

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString("base64");
  const mimeType = isVideo ? "video/mp4" : "image/jpeg";

  await page.evaluate(async ({ fileNameOnly, base64Data, mimeType }) => {
    const byteCharacters = atob(base64Data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], fileNameOnly, { type: mimeType });

    const input = document.querySelector('input[type="file"]');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { fileNameOnly: path.basename(filePath), base64Data, mimeType });

  await page.waitForTimeout(5000);
  return true;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== MAIN PUPPETEER =====
(async () => {
  try {
    console.log("🚀 Start bot...");
    const mode = process.argv[2];
    console.log("🎯 MODE:", mode);

    if (!mode) {
      console.log("⚠️ Tidak ada mode → stop bot");
      process.exit(0);
    }

    const rawAccounts = JSON.parse(fs.readFileSync(__dirname + "/accounts.json", "utf8"));
    const accounts = shuffleArray(rawAccounts);

    const TEMPLATE_PATH = "./dashboard/template1.xlsx";
    if (!fs.existsSync(TEMPLATE_PATH)) throw new Error("❌ template1.xlsx tidak ditemukan");

    const wb = XLSX.readFile(TEMPLATE_PATH);
    const templates = {};
    for (const sheetName of wb.SheetNames) {
      templates[sheetName.trim()] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
    }

    const groupRows = templates.postGroup || [];
    const statusRows = templates.postStatus || [];
    const addFriendFollowersRows = templates.addFriendFollowers || [];
    const addFriendFollowingRows = templates.addFriendFollowing || [];
    const addFriendListRows = templates.addFriendFriendlist || [];
    const undFriendRows = templates.undFriend || [];
    const confirmRows = templates.confirm || [];
    const likeLinkPostRows = templates.likelinkpost || [];
    const likeGroupRows = templates.likeGroup || []; 

    const browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    // 🔁 JALANKAN AKUN SECARA BERSAMAAN (PARALEL) MENGGUNAKAN PROMISE.ALL
    await Promise.all(
      accounts.map(async (acc) => {
        let context = null;
        let page = null;
        try {
          console.log(`\n🚀 Start akun (Paralel): ${acc.account}`);
          context = await browser.createIncognitoBrowserContext();
          page = await context.newPage();

          // ===== PATCH BUG userAgentData FACEBOOK (WAJIB)
          await page.evaluateOnNewDocument(() => {
            try {
              if (navigator.userAgentData) {
                navigator.userAgentData.getHighEntropyValues = () => {
                  return Promise.resolve({
                    architecture: "arm",
                    model: "",
                    platform: "Android",
                    platformVersion: "10",
                    uaFullVersion: "120.0.0.0"
                  });
                };
              }
            } catch (e) {}
          });
          
          await page.setBypassCSP(true);

          await page.setUserAgent(
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
          );
          await page.setViewport({
            width: 360,
            height: 825,
            hasTouch: true,
            deviceScaleFactor: 2,
            isMobile: true
          });

          await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
            window.navigator.chrome = { runtime: {} };
            Object.defineProperty(navigator, "languages", { get: () => ["id-ID", "id"] });
            Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
          });

          const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
          ).toISOString().slice(0, 10);

          const rowsStatusForAccount = statusRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsForAccount = groupRows.filter(row => {
            if (row.account !== acc.account) return false;
            const rowDate = parseTanggalXLSX(row.tanggal);
            if (rowDate !== today) return false;
            if (row.jam_post && !cocokJam(row.jam_post)) return false;
            return true;
          });

          const rowsAddFriendFollowersForAccount = addFriendFollowersRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsAddFriendFollowingForAccount = addFriendFollowingRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsAddFriendFriendsForAccount = addFriendListRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsUndfriendForAccount = undFriendRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsConfirmForAccount = confirmRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });   

          const rowsLikeGroupForAccount = likeGroupRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          const rowsLikeLinkPostForAccount = likeLinkPostRows.filter(row => {
            if (row.account !== acc.account) return false;
            return parseTanggalXLSX(row.tanggal) === today;
          });

          if (
            rowsForAccount.length === 0 && 
            rowsStatusForAccount.length === 0 && 
            rowsAddFriendFollowersForAccount.length === 0 && 
            rowsAddFriendFollowingForAccount.length === 0 && 
            rowsAddFriendFriendsForAccount.length === 0 &&
            rowsUndfriendForAccount.length === 0 && 
            rowsConfirmForAccount.length === 0 && 
            rowsLikeGroupForAccount.length === 0 && 
            rowsLikeLinkPostForAccount.length === 0
          ) {
            console.log(`⏭️ [${acc.account}] Tidak ada jadwal hari ini, skip.`);
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            return;
          }

          await page.goto("https://m.facebook.com", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3000);
          
          await page.setCookie(
            ...acc.cookies.map(c => ({
              name: c.name,
              value: c.value,
              domain: ".facebook.com",
              path: "/",
              secure: true
            }))
          );

          if (mode === "status") {
            for (const row of rowsStatusForAccount) {
              await runStatus(page, row);
            }
          } else if (mode === "group") {
            for (const row of rowsForAccount) {
              await runAccount(page, row, acc.account, today);   
            }
          } else if (mode === "addfriendfollowers") {
            for (const row of rowsAddFriendFollowersForAccount) {
              await runAddFriendFollowers(page, row);
            }
          } else if (mode === "addfriendfollowing") {
            for (const row of rowsAddFriendFollowingForAccount) {
              await runAddFriendFollowings(page, row);
            }
          } else if (mode === "addfriendfriends") {
            for (const row of rowsAddFriendFriendsForAccount) {
              await runAddFriendFriends(page, row);
            }
          } else if (mode === "undfriend") {
            for (const row of rowsUndfriendForAccount) {
              await runUndfriends(page, row);
            }
          } else if (mode === "confirm") {
            for (const row of rowsConfirmForAccount) {
              await runConfirm(page, row);
            }
          } else if (mode === "likelinkpost") {
            for (const row of rowsLikeLinkPostForAccount) {
              await runLikeLinkPosts(page, row);
            }
          } else if (mode === "likegroup") {
            for (const row of rowsLikeGroupForAccount) {
              await runLikeLinkGroups(page, row);
            }
          }

          console.log(`✅ Selesai diproses untuk akun: ${acc.account}`);

        } catch (err) {
          console.error(`❌ Error pada akun ${acc.account}:`, err.message);
        } finally {
          if (page) await page.close().catch(() => {});
          if (context) await context.close().catch(() => {});
        }
      })
    );

    fs.writeFileSync(dataPath, JSON.stringify(docsData, null, 2));
    console.log("✅ data.json berhasil diperbarui");

    await browser.close();
    console.log("🎉 Semua akun selesai dijalankan secara paralel");
  } catch (err) {
    console.error("❌ Error utama:", err);
  }
})();
