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
  const { url, title, year, quality } = req.query;

  // Validate required params
  if (!url || !title || !year) {
    return res
      .status(400)
      .send("Missing parameters: url, title, and year are required.");
  }

  // Clean up inputs / provide fallback for quality
  const cleanTitle = title.trim();
  const cleanYear = year.trim();
  const cleanQuality = quality ? quality.trim() : "unknown-quality";

  // Create HTTPS agent that ignores invalid certs (dev only!)
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    // First, fetch headers to inspect content-type
    const head = await axios.head(url, { httpsAgent: agent });
    const contentType = (head.headers["content-type"] || "").toLowerCase();

    // Determine file extension
    let ext = path.extname(new URL(url).pathname);
    if (!ext) {
      // fallback to .torrent
      ext = ".torrent";
    }

    // Build filename with quality tag
    // e.g. "Inception (2010) [1080p] [getRONed].torrent"
    const filename = `${cleanTitle} (${cleanYear}) [${cleanQuality}] [getRONed]${ext}`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // Stream the file down to disk
    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      httpsAgent: agent,
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      // Send the file to the client, then delete it
      res.download(filepath, filename, async (err) => {
        if (err) console.error("Error sending file:", err);
        try {
          await fs.remove(filepath);
        } catch (cleanupErr) {
          console.error("Cleanup failed:", cleanupErr);
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
