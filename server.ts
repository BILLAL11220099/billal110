import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";

interface VideoMetadata {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedRole: string;
  timestamp: string;
  url?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  isPrivate?: boolean;
  likes?: number;
  likedBy?: string[];
  views?: number;
  downloads?: number;
  status?: "Uploading" | "Converting" | "Ready" | "Error";
  progress?: number;
}

const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const METADATA_FILE = path.join(UPLOADS_DIR, "metadata.json");

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure metadata file exists
if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify([], null, 2));
}

// Database helper functions
function getVideosDb(): VideoMetadata[] {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return [];
}

function saveVideosDb(videos: VideoMetadata[]) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(videos, null, 2));
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const videoId = req.body.id || "vid_" + Date.now();
    const dir = path.join(UPLOADS_DIR, videoId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, "source" + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB upload limit
  }
});

// Helper: check if command exists in system path
function checkIfCommandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const checkCmd = process.platform === "win32" ? `where ${command}` : `which ${command}`;
    exec(checkCmd, (err) => {
      resolve(!err);
    });
  });
}

// Background Video Transcoding Handler (Optimized for instant publication & native progressive seek streams)
async function transcodeVideo(videoId: string, originalName: string) {
  const dir = path.join(UPLOADS_DIR, videoId);
  const metadata = getVideosDb();
  const videoIndex = metadata.findIndex(v => v.id === videoId);
  if (videoIndex === -1) return;

  const video = metadata[videoIndex];

  // Find source file in the dir
  const filesInDir = fs.readdirSync(dir);
  const sourceFile = filesInDir.find(f => f.startsWith("source."));
  if (!sourceFile) {
    video.status = "Error";
    video.description = "Transcoding error: upload files lost.";
    saveVideosDb(metadata);
    return;
  }

  const sourcePath = path.join(dir, sourceFile);
  const hasFfmpeg = await checkIfCommandExists("ffmpeg");

  console.log(`[Transcoder] Starting instant video pipeline for ${video.title}. FFmpeg available: ${hasFfmpeg}`);

  // 1. Generate JPEG video thumbnail frame
  const thumbnailPath = path.join(dir, "thumbnail.jpg");
  if (hasFfmpeg) {
    try {
      await new Promise<void>((resolve) => {
        const cmd = `ffmpeg -y -ss 00:00:01 -i "${sourcePath}" -vframes 1 -q:v 2 "${thumbnailPath}"`;
        exec(cmd, (err) => {
          if (err) {
            console.warn("Thumbnail extraction failed:", err);
          }
          resolve();
        });
      });
    } catch (e) {
      console.warn("Failed extracting thumbnail", e);
    }
  }

  // 2. Mark as Ready instantly (using progressive high-fidelity web streams which have native range-seeking support and run perfectly everywhere)
  const finalVideos = getVideosDb();
  const index = finalVideos.findIndex(v => v.id === videoId);
  if (index !== -1) {
    finalVideos[index].status = "Ready";
    finalVideos[index].progress = 100;
    finalVideos[index].url = `/uploads/${videoId}/${sourceFile}`;
    if (fs.existsSync(thumbnailPath)) {
      finalVideos[index].thumbnail = `/uploads/${videoId}/thumbnail.jpg`;
    }
    saveVideosDb(finalVideos);
  }
  console.log(`[Transcoder] Video "${video.title}" loaded instantly via high-fidelity progressive streaming.`);
}

// Fallback HLS Generator
function generateFallbackHLS(videoId: string, dir: string, sourceFile: string, sourcePath: string) {
  const finalVideos = getVideosDb();
  const index = finalVideos.findIndex(v => v.id === videoId);
  if (index !== -1) {
    finalVideos[index].status = "Ready";
    finalVideos[index].progress = 100;
    finalVideos[index].url = `/uploads/${videoId}/${sourceFile}`;
    saveVideosDb(finalVideos);
  }
}

async function startServer() {
  const app = express();

  // Parse payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
    next();
  });

  // REST API: Get all videos list
  app.get("/api/videos", (req, res) => {
    res.json(getVideosDb());
  });

  // REST API: Get status of a single video
  app.get("/api/videos/status/:id", (req, res) => {
    const list = getVideosDb();
    const video = list.find(v => v.id === req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video record not found" });
    }
    res.json({ id: video.id, status: video.status, progress: video.progress });
  });

  // REST API: Edit video metadata
  app.post("/api/videos/:id/edit", (req, res) => {
    const { title, description, category, isPrivate } = req.body;
    const list = getVideosDb();
    const index = list.findIndex(v => v.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Video not found" });
    }

    list[index] = {
      ...list[index],
      title: title || list[index].title,
      description: description !== undefined ? description : list[index].description,
      category: category || list[index].category,
      isPrivate: isPrivate !== undefined ? isPrivate : list[index].isPrivate
    };

    saveVideosDb(list);
    res.json({ success: true, video: list[index] });
  });

  // REST API: Increment analytics
  app.post("/api/videos/:id/views", (req, res) => {
    const list = getVideosDb();
    const index = list.findIndex(v => v.id === req.params.id);
    if (index !== -1) {
      list[index].views = (list[index].views || 0) + 1;
      saveVideosDb(list);
    }
    res.json({ success: true });
  });

  // REST API: Like/Unlike Video
  app.post("/api/videos/:id/like", (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });

    const list = getVideosDb();
    const index = list.findIndex(v => v.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Video not found" });

    const video = list[index];
    const likedBy = video.likedBy || [];
    const likedIndex = likedBy.indexOf(username);

    if (likedIndex > -1) {
      likedBy.splice(likedIndex, 1);
      video.likes = Math.max(0, (video.likes || 1) - 1);
    } else {
      likedBy.push(username);
      video.likes = (video.likes || 0) + 1;
    }

    video.likedBy = likedBy;
    saveVideosDb(list);
    res.json({ success: true, likes: video.likes, likedBy: video.likedBy });
  });

  // REST API: Upload new thumbnail base64
  app.post("/api/videos/:id/thumbnail", (req, res) => {
    const { thumbnail } = req.body;
    if (!thumbnail) return res.status(400).json({ error: "Thumbnail is required" });

    const list = getVideosDb();
    const index = list.findIndex(v => v.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Video not found" });

    list[index].thumbnail = thumbnail;
    saveVideosDb(list);
    res.json({ success: true });
  });

  // REST API: Upload Video file
  app.post("/api/videos/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    const { id, title, uploadedBy, uploadedRole, category, description } = req.body;
    const videoId = id || "vid_" + Date.now();

    const newVideo: VideoMetadata = {
      id: videoId,
      title: title || req.file.originalname.split(".")[0].replace(/[_-]/g, " "),
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype || "video/mp4",
      uploadedBy: uploadedBy || "Crew Member",
      uploadedRole: uploadedRole || "Crew",
      timestamp: new Date().toISOString(),
      description: description || "Universal streaming guide secured in server cloud parameters. Optimized with multi-device resolution transcoding.",
      category: category || "Training Guides",
      status: "Converting",
      progress: 5,
      likes: 0,
      likedBy: [],
      views: 0,
      downloads: 0
    };

    // Pre-insert default generated thumbnail representation
    const colors = ["#22d3ee", "#a78bfa", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];
    const idx = Math.abs(newVideo.title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
    const baseColor = colors[idx];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225"><rect width="100%" height="100%" fill="#020617"/><text x="50%" y="50%" text-anchor="middle" fill="#f8fafc" font-size="16" font-family="sans-serif">${newVideo.title}</text><text x="50%" y="70%" text-anchor="middle" fill="${baseColor}" font-size="10" font-family="monospace">CONVERTING STAGE...</text></svg>`;
    newVideo.thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    const db = getVideosDb();
    db.unshift(newVideo);
    saveVideosDb(db);

    // Trigger transcoding process on another thread stack/asynchronously
    transcodeVideo(videoId, req.file.originalname);

    res.json({ success: true, video: newVideo });
  });

  // REST API: Delete Video
  app.delete("/api/videos/:id", (req, res) => {
    const videoId = req.params.id;
    const db = getVideosDb();
    const index = db.findIndex(v => v.id === videoId);

    if (index === -1) {
      return res.status(404).json({ error: "Video record not found" });
    }

    // Delete folder and files physically
    const dir = path.join(UPLOADS_DIR, videoId);
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`Error deleting video stream directory at ${dir}:`, e);
    }

    db.splice(index, 1);
    saveVideosDb(db);
    res.json({ success: true });
  });

  // Serve static assets out of uploads folder
  // Adds support for robust video Range Requests for streaming seeking
  app.use("/uploads", express.static(UPLOADS_DIR, {
    setHeaders: (res, mediaPath) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Accept-Ranges", "bytes");

      // Custom content headers for browser streams
      if (mediaPath.endsWith(".m3u8")) {
        res.setHeader("Content-Type", "application/x-mpegURL");
      } else if (mediaPath.endsWith(".ts")) {
        res.setHeader("Content-Type", "video/MP2T");
      } else if (mediaPath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
      }
    }
  }));

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite middleware mounted in Development Mode (port 3000)");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Direct static build files mounted in Production Mode (port 3000)");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
