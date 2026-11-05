
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const account =
      typeof body.account === "string" ? body.account.trim() : "";

    const tanggal =
      typeof body.tanggal === "string" ? body.tanggal.trim() : "";

    const groups = body.groups;

    if (!account) {
      return res.status(400).json({
        success: false,
        error: "account wajib diisi"
      });
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
      new Date(`${tanggal}T00:00:00Z`).toISOString().slice(0, 10) !== tanggal
    ) {
      return res.status(400).json({
        success: false,
        error: "tanggal wajib berformat YYYY-MM-DD dan valid"
      });
    }

    if (!Array.isArray(groups)) {
      return res.status(400).json({
        success: false,
        error: "groups harus berupa array"
      });
    }

    // Bersihkan dan validasi grup
    const cleanGroups = [];
    const seenLinks = new Set();

    for (const group of groups) {
      const groupLink =
        typeof group?.group_link === "string"
          ? group.group_link.trim()
          : "";

      if (!groupLink) continue;

      let parsed;

      try {
        parsed = new URL(groupLink);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Ada group_link yang bukan URL valid"
        });
      }

      if (
        !/(^|\.)facebook\.com$/i.test(parsed.hostname) ||
        !parsed.pathname.includes("/groups/")
      ) {
        return res.status(400).json({
          success: false,
          error: "group_link harus berupa tautan grup Facebook"
        });
      }

      if (seenLinks.has(groupLink)) continue;

      seenLinks.add(groupLink);

      cleanGroups.push({
        tanggal,
        group_link: groupLink,
        group_name:
          typeof group.group_name === "string"
            ? group.group_name.trim()
            : "",
        group_photo:
          typeof group.group_photo === "string"
            ? group.group_photo
            : ""
      });
    }

    // GitHub token
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        error: "GITHUB_TOKEN belum disetel di Vercel"
      });
    }

    const owner = "Rulispro";
    const repo = "FGA-fake";
    const path = "docs/shareTargets.json";

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    // Baca file lama dari GitHub
    const getResponse = await fetch(apiUrl, {
      headers,
      cache: "no-store"
    });

    let oldData = {};
    let sha;

    if (getResponse.ok) {
      const file = await getResponse.json();

      sha = file.sha;

      if (!file.content) {
        oldData = {};
      } else {
        const decodedContent = Buffer.from(
          file.content.replace(/\s/g, ""),
          "base64"
        )
          .toString("utf8")
          .replace(/^\uFEFF/, "")
          .trim();

        try {
          oldData = decodedContent
            ? JSON.parse(decodedContent)
            : {};
        } catch (error) {
          console.error(
            "ISI JSON GITHUB:",
            JSON.stringify(decodedContent)
          );

          throw new Error(
            "Format docs/shareTargets.json tidak valid: " +
            error.message
          );
        }
      }

      if (
        !oldData ||
        typeof oldData !== "object" ||
        Array.isArray(oldData)
      ) {
        oldData = {};
      }

    } else if (getResponse.status !== 404) {
      const detail = await getResponse.text();

      return res.status(502).json({
        success: false,
        error: `Gagal membaca file GitHub: ${detail}`
      });
    }

    // Simpan pilihan akun dan tanggal.
    // Data akun lain dan tanggal lain tetap dipertahankan.
    const accountGroups = Array.isArray(oldData[account])
      ? oldData[account]
      : [];

    oldData[account] = accountGroups
      .filter(item => item?.tanggal !== tanggal)
      .concat(cleanGroups);

    if (oldData[account].length === 0) {
      delete oldData[account];
    }

    // Tulis kembali ke GitHub
    const putResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Update share targets for ${account} (${tanggal})`,
        content: Buffer.from(
          JSON.stringify(oldData, null, 2),
          "utf8"
        ).toString("base64"),
        ...(sha ? { sha } : {})
      })
    });

    const result = await putResponse.json();

    if (!putResponse.ok) {
      console.error("GITHUB SAVE ERROR:", result);

      return res.status(502).json({
        success: false,
        error:
          result.message ||
          "GitHub gagal menyimpan shareTargets.json"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Data berhasil disimpan ke GitHub",
      account,
      tanggal,
      count: cleanGroups.length
    });

  } catch (error) {
    console.error("SHARE TARGET ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan server"
    });
  }
}
