// server.js
const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
fs.ensureDirSync(DOWNLOAD_DIR);

app.get("/download", async (req, res) => {
  const { url, title, year } = req.query;
  if (!url || !title || !year) {
    return res
      .status(400)
      .send("Missing parameters: url, title, and year are required.");
  }

  // Create HTTPS agent that ignores invalid certs (dev only!)
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    // First, fetch headers to inspect content-type
    const head = await axios.head(url, { httpsAgent: agent });
    const contentType = (head.headers["content-type"] || "").toLowerCase();

    // Determine extension
    let ext = path.extname(new URL(url).pathname);
    if (!ext) {
      if (contentType.includes("torrent")) {
        ext = ".torrent";
      } else {
        ext = ".torrent";
      }
    }

    const filename = `${title} (${year}) [getRONed]${ext}`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // Now stream the file
    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      httpsAgent: agent,
    });

    // Pipe to disk
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      res.download(filepath, filename, async (err) => {
        if (err) console.error("Error sending file:", err);
        try {
          await fs.remove(filepath);
          console.log(`removed`);
        } catch (e) {
          console.error("Cleanup failed:", e);
        }
      });
    });

    writer.on("error", (err) => {
      console.error("Write stream error:", err);
      res.status(500).send("Failed to save file on server.");
    });
  } catch (err) {
    console.error("Error downloading file:", err.message);
    res.status(500).send("Failed to download file.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
