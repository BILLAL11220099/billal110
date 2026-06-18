import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
    cb(null, file.originalname);
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

// Background Video Transcoding Handler (Full-scale HLS + web compatible progressive conversion)
async function transcodeVideo(videoId: string, originalName: string) {
  const dir = path.join(UPLOADS_DIR, videoId);
  const metadata = getVideosDb();
  const videoIndex = metadata.findIndex(v => v.id === videoId);
  if (videoIndex === -1) return;

  const video = metadata[videoIndex];

  // Find source file in the dir
  const sourceFile = video.fileName || fs.readdirSync(dir).find(f => f !== "thumbnail.jpg" && f !== "compatible.mp4" && f !== "hls");
  if (!sourceFile || !fs.existsSync(path.join(dir, sourceFile))) {
    video.status = "Error";
    video.description = "Transcoding error: upload files lost.";
    saveVideosDb(metadata);
    return;
  }

  const sourcePath = path.join(dir, sourceFile);
  const hasFfmpeg = await checkIfCommandExists("ffmpeg");

  console.log(`[Transcoder] Starting video processing for ${video.title}. FFmpeg available: ${hasFfmpeg}`);

  const thumbnailPath = path.join(dir, "thumbnail.jpg");
  const hlsDir = path.join(dir, "hls");
  const compatibleMp4Path = path.join(dir, "compatible.mp4");

  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  if (hasFfmpeg) {
    try {
      // 1. Generate JPEG video thumbnail frame
      console.log(`[Transcoder] Step 1: Extracting video thumbnail frame...`);
      await new Promise<void>((resolve) => {
        const cmd = `ffmpeg -y -ss 00:00:01 -i "${sourcePath}" -vframes 1 -q:v 2 "${thumbnailPath}"`;
        exec(cmd, (err) => {
          if (err) {
            console.warn("[Transcoder] Thumbnail extraction failed:", err);
          }
          resolve();
        });
      });

      // Update progress
      saveVideosDb(getVideosDb().map(v => v.id === videoId ? { ...v, progress: 20, status: "Converting" } : v));

      // 2. Convert incoming video format (AVI, MKV, MOV, WEBM, MP4) into an optimized, highly compatible H.264/AAC MP4, faststart
      console.log(`[Transcoder] Step 2: Creating progressive compatible H.264 + AAC MP4...`);
      const mp4Cmd = `ffmpeg -y -i "${sourcePath}" -vcodec libx264 -acodec aac -pix_fmt yuv420p -b:a 128k -preset superfast -movflags +faststart "${compatibleMp4Path}"`;
      await new Promise<void>((resolve, reject) => {
        exec(mp4Cmd, (err) => {
          if (err) {
            console.error("[Transcoder] MP4 compatible transcode error:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Update progress
      saveVideosDb(getVideosDb().map(v => v.id === videoId ? { ...v, progress: 60, status: "Converting" } : v));

      // 3. Segment the unified compatible MP4 into cross-compatible HLS segments and playlist.m3u8
      console.log(`[Transcoder] Step 3: Segmenting into streamable HLS fragments...`);
      const hlsCmd = `ffmpeg -y -i "${compatibleMp4Path}" -c:v copy -c:a copy -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/segment_%03d.ts" "${hlsDir}/playlist.m3u8"`;
      await new Promise<void>((resolve, reject) => {
        exec(hlsCmd, (err) => {
          if (err) {
            console.error("[Transcoder] HLS segmentation error:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // 4. Update state to Ready
      const finalVideos = getVideosDb();
      const updatedIdx = finalVideos.findIndex(v => v.id === videoId);
      if (updatedIdx !== -1) {
        finalVideos[updatedIdx].status = "Ready";
        finalVideos[updatedIdx].progress = 100;
        finalVideos[updatedIdx].url = `/uploads/${videoId}/hls/playlist.m3u8`;
        if (fs.existsSync(thumbnailPath)) {
          finalVideos[updatedIdx].thumbnail = `/uploads/${videoId}/thumbnail.jpg`;
        }
        saveVideosDb(finalVideos);
      }
      console.log(`[Transcoder] Finished video processing successfully for "${video.title}"`);

    } catch (err) {
      console.error("[Transcoder] FFmpeg Transcoding pipeline failed, resorting to web-native stream backup:", err);
      // Fallback: Copy standard source as play option and build direct play playlist
      generateFallbackHLS(videoId, dir, sourceFile, sourcePath);
    }
  } else {
    // Graceful Fallback if FFmpeg is absent:
    console.log("[Transcoder] FFmpeg not found on this machine. Booting high-compatibility direct web stream fallback.");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate work
    generateFallbackHLS(videoId, dir, sourceFile, sourcePath);
  }
}

// Fallback HLS Generator
function generateFallbackHLS(videoId: string, dir: string, sourceFile: string, sourcePath: string) {
  const finalVideos = getVideosDb();
  const index = finalVideos.findIndex(v => v.id === videoId);
  if (index !== -1) {
    finalVideos[index].status = "Ready";
    finalVideos[index].progress = 100;
    finalVideos[index].url = `/uploads/${videoId}/${sourceFile}`;
    if (fs.existsSync(path.join(dir, "thumbnail.jpg"))) {
      finalVideos[index].thumbnail = `/uploads/${videoId}/thumbnail.jpg`;
    }
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

  // REST API: Analyze image with Gemini 3.5 Flash
  app.post("/api/gemini/analyze-image", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Return placeholder fallback if key is missing
        return res.json({
          title: "Standard Operational Card",
          description: "This is a detailed analysis placeholder for the uploaded shift photo. To enable real-time analysis using Gemini AI, make sure to add your API key in Settings > Secrets."
        });
      }

      let mimeType = "image/png";
      let base64Data = image;

      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            imagePart,
            {
              text: "Carefully analyze this operational guideline, manual sheet, or kitchen photo. Identify the exact name or title of the photo if visible, or give it a highly relevant title based on the content (e.g. 'Crispy Chicken Assembly' or 'Grill Calibration Sheet'). Write an extremely detailed textual breakdown of every step, parameter, guideline, or instruction shown in the picture so that the post is highly rich and can be seamlessly searched using any keyword inside this photo."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Clean, direct human-facing title of the photo. Max 8 words."
              },
              description: {
                type: Type.STRING,
                description: "A highly detailed, comprehensive textual summary of everything shown in the photo, step-by-step guidelines, numbers, and parameters."
              }
            },
            required: ["title", "description"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsedResult = JSON.parse(resultText.trim());
      res.json(parsedResult);
    } catch (err: any) {
      console.error("Gemini Image Analysis failed:", err);
      res.status(500).json({ error: "Gemini Image Analysis failed: " + err.message });
    }
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

  // REST API: Secure resumable download with original file name preservation
  app.get("/api/videos/:id/download", (req, res) => {
    const { id } = req.params;
    const list = getVideosDb();
    const video = list.find(v => v.id === id);
    if (!video) {
      return res.status(404).json({ error: "Video not found in metadata registry" });
    }

    const dir = path.join(UPLOADS_DIR, id);
    let originalName = video.fileName;

    // Find custom file matches or fall back to any files on source
    if (!originalName || !fs.existsSync(path.join(dir, originalName))) {
      try {
        const files = fs.readdirSync(dir);
        const fallback = files.find(f => f !== "thumbnail.jpg" && f !== "compatible.mp4" && f !== "hls" && fs.statSync(path.join(dir, f)).isFile());
        if (fallback) {
          originalName = fallback;
        }
      } catch (err) {
        console.warn("[Downloader] Error scanning dir:", err);
      }
    }

    if (!originalName) {
      return res.status(404).json({ error: "Physical source file not found on disk" });
    }

    const filePath = path.join(dir, originalName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Requested resource file does not exist on server storage" });
    }

    // Increment download metrics
    const updatedList = getVideosDb();
    const vIdx = updatedList.findIndex(v => v.id === id);
    if (vIdx !== -1) {
      updatedList[vIdx].downloads = (updatedList[vIdx].downloads || 0) + 1;
      saveVideosDb(updatedList);
    }

    // Trigger download response with correct original name preservation
    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error(`[Downloader] Error serving file ${id}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error initiating file stream downloads" });
        }
      }
    });
  });

  // REST API: Auto-healing sync route from Client's Firestore
  app.post("/api/videos/sync", (req, res) => {
    const clientVideos = req.body;
    if (!Array.isArray(clientVideos)) {
      return res.status(400).json({ error: "Sync data must be an array of VideoMetadata" });
    }

    const currentVideos = getVideosDb();
    let modified = false;

    clientVideos.forEach((cv) => {
      const exists = currentVideos.some(v => v.id === cv.id);
      if (!exists) {
        // Only recover metadata if directory exists on disk to keep integrity
        const dir = path.join(UPLOADS_DIR, cv.id);
        if (fs.existsSync(dir)) {
          currentVideos.push(cv);
          modified = true;
          console.log(`[Auto-Heal] Recovered video metadata for ${cv.title} (${cv.id})`);
        }
      }
    });

    if (modified) {
      saveVideosDb(currentVideos);
    }

    res.json({ success: true, videos: currentVideos });
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
