const express = require("express");
const cors = require("cors");
const multer = require("multer");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

["uploads", "outputs"].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.post(
  "/upload",
  upload.fields([{ name: "video" }, { name: "subtitles" }]),
  (req, res) => {
    try {
      const videoPath = req.files.video[0].path;
      const subtitlesPath = req.files.subtitles[0].path;

      const styles = {
        fontName: req.body.fontName || "Bauhaus 93",
        fontSize: req.body.fontSize || 24,
        fontColor: req.body.fontColor || "FFFFFF",
        bold: req.body.bold ? 1 : 1,
        italic: req.body.italic ? 1 : 0,
        borderWidth: req.body.borderWidth || 1,
        borderColor: req.body.borderColor || "000000",
        alignment: req.body.alignment || 2,
      };

      const escapedSubtitlesPath = subtitlesPath
        .replace(/\\/g, "/")
        .replace(/:/g, "\\:")
        .replace(/'/g, "'\\''");

      const outputPath = path.join(
        __dirname,
        "outputs",
        `output_${Date.now()}.mp4`
      );

      const styleString =
        `subtitles=${escapedSubtitlesPath}:force_style='` +
        `FontName=${styles.fontName},` +
        `Fontsize=${styles.fontSize},` +
        `PrimaryColour=&H${styles.fontColor}&,` +
        `Bold=${styles.bold},` +
        `Italic=${styles.italic},` +
        `BorderStyle=1,` +
        `Outline=${styles.borderWidth},` +
        `OutlineColour=&H${styles.borderColor}&,` +
        `Alignment=${styles.alignment}'`;

      ffmpeg(videoPath)
        .videoFilter(styleString)
        .output(outputPath)
        .on("start", (cmd) => {
          console.log("Started ffmpeg with command:", cmd);
        })
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on("end", () => {
          res.download(outputPath, "output.mp4", () => {
            [videoPath, subtitlesPath, outputPath].forEach((file) => {
              fs.unlink(file, (err) => {
                if (err) console.error(`Error deleting ${file}:`, err);
              });
            });
          });
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          res.status(500).json({
            error: "Video processing failed",
            details: err.message,
          });
        })
        .run();
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({
        error: "Server error",
        details: err.message,
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
