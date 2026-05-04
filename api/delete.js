export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const newData = req.body;

    const owner = "Rulispro";
    const repo = "FGA-fake";
    const path = "docs/groups.json";

    const token = process.env.GITHUB_TOKEN;

    const getFile = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const file = await getFile.json();

    let oldData = {};

    if (file.content) {
      oldData = JSON.parse(Buffer.from(file.content, "base64").toString());
    }

    // 🔥 CLEAN DATA LAMA
    Object.keys(oldData).forEach(acc => {
      oldData[acc] = (oldData[acc] || []).filter(g => g.tanggal);
    });

    // 🔥 MERGE DATA BARU
// 🔥 LANGSUNG REPLACE TOTAL
const finalData = newData;

    const updated = Buffer.from(
  JSON.stringify(finalData, null, 2)
).toString("base64");
    
    await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "update selected groups",
        content: updated,
        sha: file.sha || undefined,
      }),
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
