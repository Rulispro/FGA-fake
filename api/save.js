export default async function handler(req, res) {

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
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: "type & data wajib diisi" });
    }

    const owner = "Rulispro";
    const repo = "FGA-fake";

    // 🔥 tentukan file
    let path = "";
    if (type === "groups") path = "docs/groups.json";
    if (type === "selected") path = "docs/selected.json";

    if (!path) {
      return res.status(400).json({ error: "type tidak valid" });
    }

    const token = process.env.GITHUB_TOKEN;

    const getFile = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const file = await getFile.json();

    const updated = Buffer.from(
      JSON.stringify(data, null, 2)
    ).toString("base64");

    await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `update ${type}`,
        content: updated,
        sha: file.sha || undefined,
      }),
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
