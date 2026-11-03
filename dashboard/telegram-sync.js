"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID; // contoh "@mychannel" atau "-1001234567890"
const ACCOUNT_NAME = process.env.TELEGRAM_ACCOUNT_NAME; // contoh "akunA"
const DOCS_DIR = path.join(__dirname, "..", "docs");
const JADWAL_PATH = path.join(DOCS_DIR, "jadwal.json");
const STATE_PATH = path.join(DOCS_DIR, "telegram-state.json");

function ensureDocs() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

function loadJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getTodayKey() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  ).toISOString().slice(0, 10);
}

function getCurrentSlot() {
  const slot = (process.env.SCHEDULE_SLOT || process.env.JADWAL_SLOT || "").toUpperCase();
  if (slot) return slot;

  const hour = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  ).getHours();

  if (hour >= 0 && hour < 12) return "PAGI";
  if (hour >= 12 && hour < 18) return "SIANG";
  return "MALAM";
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Invalid Telegram JSON: ${raw}`));
        }
      });
    });

    req.on("error", reject);
  });
}

function isChannelMatch(chat, channelRaw) {
  if (!chat) return false;
  const target = String(channelRaw || "").trim();

  if (!target) return false;

  const chatId = String(chat.id || "");
  const username = String(chat.username || "").replace("@", "");
  const title = String(chat.title || "").trim();

  if (chatId === target) return true;
  if (username && username === target.replace("@", "")) return true;
  if (title && title === target) return true;
  return false;
}

function extractMediaFromMessage(message) {
  if (!message) return null;

  const photo = Array.isArray(message.photo)
    ? message.photo[message.photo.length - 1]
    : null;

  const video = message.video || null;
  const document = message.document || null;

  if (!photo && !video && !document) return null;

  let fileId = null;
  let type = "media";

  if (photo) {
    fileId = photo.file_id;
    type = "photo";
  } else if (video) {
    fileId = video.file_id;
    type = "video";
  } else if (document) {
    fileId = document.file_id;
    type = "document";
  }

  if (!fileId) return null;

  return {
    file_id: fileId,
    type,
    caption: String(message.caption || "").trim(),
    date: message.date
  };
}

async function getNewChannelMedia() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN belum di-set");
  if (!CHANNEL_ID) throw new Error("TELEGRAM_CHANNEL_ID belum di-set");
  if (!ACCOUNT_NAME) throw new Error("TELEGRAM_ACCOUNT_NAME belum di-set");

  const state = loadJson(STATE_PATH, { last_update_id: 0 });
  const url =
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&offset=${state.last_update_id || 0}&allowed_updates=["message","channel_post"]`;

  const data = await fetchJson(url);

  if (!data.ok) {
    throw new Error(data.description || "getUpdates gagal");
  }

  const updates = data.result || [];
  const collected = [];

  for (const update of updates) {
    const message = update.message || update.channel_post;
    if (!message) continue;

    const chat = message.chat || null;
    if (!chat) continue;

    if (!isChannelMatch(chat, CHANNEL_ID)) continue;

    const media = extractMediaFromMessage(message);
    if (media) {
      collected.push(media);
    }
  }

  if (!updates.length) {
    return [];
  }

  const maxUpdateId = Math.max(...updates.map((u) => Number(u.update_id || 0)));
  state.last_update_id = maxUpdateId + 1;
  saveJson(STATE_PATH, state);

  return collected;
}

function appendFileIdsToSchedule(fileIds, account, dateKey, slot) {
  const schedule = loadJson(JADWAL_PATH, {});
  if (!schedule[account]) schedule[account] = {};
  if (!schedule[account][dateKey]) schedule[account][dateKey] = {};

  const current = Array.isArray(schedule[account][dateKey][slot])
    ? schedule[account][dateKey][slot]
    : [];

  for (const id of fileIds) {
    if (!current.includes(id)) {
      current.push(id);
    }
  }

  schedule[account][dateKey][slot] = current;

  saveJson(JADWAL_PATH, schedule);
}

async function syncTelegramToSchedule() {
  ensureDocs();

  const mediaList = await getNewChannelMedia();
  if (!mediaList.length) {
    console.log("✅ Tidak ada media baru di channel Telegram");
    return;
  }

  const fileIds = mediaList.map((m) => m.file_id);
  const dateKey = getTodayKey();
  const slot = getCurrentSlot();

  appendFileIdsToSchedule(fileIds, ACCOUNT_NAME, dateKey, slot);

  console.log("✅ Telegram sync selesai");
  console.log("  akun :", ACCOUNT_NAME);
  console.log("  date :", dateKey);
  console.log("  slot :", slot);
  console.log("  total:", fileIds.length);
}

if (require.main === module) {
  syncTelegramToSchedule()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Telegram sync error:", err.message);
      process.exit(1);
    });
}

module.exports = {
  syncTelegramToSchedule,
  getCurrentSlot,
  getTodayKey
};
