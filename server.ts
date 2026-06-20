import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection, getDoc, updateDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBytes } from "firebase/storage";

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
  downloadUrl?: string;
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

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

let fbApp: any, fbAuth: any, fbDb: any, fbStorage: any;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  fbApp = initializeApp(firebaseConfig);
  fbAuth = getAuth(fbApp);
  fbDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  fbStorage = getStorage(fbApp);

  signInAnonymously(fbAuth).catch(err => console.error("Firebase Backend Auth Error:", err));
} catch (configErr) {
  console.error("Critical: Could not load Firebase config locally on Server.", configErr);
}

// Helper: check if command exists in system path
function checkIfCommandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const checkCmd = process.platform === "win32" ? `where ${command}` : `which ${command}`;
    exec(checkCmd, (err) => {
      resolve(!err);
    });
  });
}

// Helper to recursively upload directory structures to Firebase Cloud Storage
async function uploadDirectoryToStorage(localDirPath: string, remoteDirPath: string, fbStorageInstance: any) {
  if (!fs.existsSync(localDirPath)) return;
  const files = fs.readdirSync(localDirPath);
  for (const file of files) {
    const fullPath = path.join(localDirPath, file);
    const remotePath = `${remoteDirPath}/${file}`;
    if (fs.statSync(fullPath).isDirectory()) {
      await uploadDirectoryToStorage(fullPath, remotePath, fbStorageInstance);
    } else {
      const fileBuffer = fs.readFileSync(fullPath);
      let contentType = "application/octet-stream";
      if (file.endsWith(".m3u8")) {
        contentType = "application/x-mpegURL";
      } else if (file.endsWith(".ts")) {
        contentType = "video/MP2T";
      } else if (file.endsWith(".mp4")) {
        contentType = "video/mp4";
      } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
        contentType = "image/jpeg";
      }
      const fileRef = storageRef(fbStorageInstance, remotePath);
      await uploadBytes(fileRef, new Uint8Array(fileBuffer), { contentType });
    }
  }
}

// Background Video Transcoding Handler
async function transcodeVideo(videoId: string, originalName: string) {
  const dir = path.join(UPLOADS_DIR, videoId);
  const sourcePath = path.join(dir, originalName);

  if (!fs.existsSync(sourcePath)) {
    console.error("[Transcoder] Missing source file", sourcePath);
    if(fbDb) await setDoc(doc(fbDb, "videos", videoId), { status: "Error", description: "Upload lost before processing" }, { merge: true });
    return;
  }

  const hasFfmpeg = await checkIfCommandExists("ffmpeg");
  
  const thumbnailPath = path.join(dir, "thumbnail.jpg");
  const compatibleMp4Path = path.join(dir, "compatible.mp4");

  if (hasFfmpeg) {
    try {
      console.log(`[Transcoder] Generating thumbnail for ${videoId}...`);
      await new Promise<void>((resolve) => {
        exec(`ffmpeg -y -ss 00:00:00.500 -i "${sourcePath}" -vframes 1 -q:v 2 "${thumbnailPath}"`, () => resolve());
      });
      if(fbDb) await setDoc(doc(fbDb, "videos", videoId), { progress: 10, status: "Converting" }, { merge: true });

      console.log(`[Transcoder] Converting to compatible MP4 for ${videoId}...`);
      const mp4Cmd = `ffmpeg -y -i "${sourcePath}" -vcodec libx264 -acodec aac -pix_fmt yuv420p -b:a 128k -preset superfast -movflags +faststart "${compatibleMp4Path}"`;
      await new Promise<void>((resolve, reject) => {
        exec(mp4Cmd, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      if(fbDb) await setDoc(doc(fbDb, "videos", videoId), { progress: 30, status: "Converting" }, { merge: true });

      // Generate HLS Folder
      const hlsDir = path.join(dir, "hls");
      if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });

      // Resolutions to generate
      const resolutions = [
        { name: "240p", height: 240, vBitrate: "300k", aBitrate: "64k" },
        { name: "360p", height: 360, vBitrate: "600k", aBitrate: "96k" },
        { name: "480p", height: 480, vBitrate: "1000k", aBitrate: "128k" },
        { name: "720p", height: 720, vBitrate: "2500k", aBitrate: "128k" },
        { name: "1080p", height: 1080, vBitrate: "4500k", aBitrate: "192k" }
      ];

      for (let i = 0; i < resolutions.length; i++) {
        const res = resolutions[i];
        console.log(`[Transcoder] Transcoding HLS stream level: ${res.name} for ${videoId}...`);
        
        // Execute ffmpeg with audio mapping
        const hasAudioCmd = `ffmpeg -y -i "${sourcePath}" -vf "scale=-2:${res.height}" -c:v libx264 -preset ultrafast -b:v ${res.vBitrate} -maxrate ${res.vBitrate} -bufsize ${parseInt(res.vBitrate)*2}k -c:a aac -b:a ${res.aBitrate} -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/${res.name}_%03d.ts" "${hlsDir}/${res.name}.m3u8"`;
        
        await new Promise<void>((resolve) => {
          exec(hasAudioCmd, (err) => {
            if (err) {
              console.warn(`[Transcoder] Ffmpeg with audio failed for level ${res.name}, falling back to silent video mode`, err);
              // Retry without audio mapping (-an)
              const silentCmd = `ffmpeg -y -i "${sourcePath}" -vf "scale=-2:${res.height}" -c:v libx264 -preset ultrafast -b:v ${res.vBitrate} -maxrate ${res.vBitrate} -bufsize ${parseInt(res.vBitrate)*2}k -an -hls_time 6 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/${res.name}_%03d.ts" "${hlsDir}/${res.name}.m3u8"`;
              exec(silentCmd, () => resolve());
            } else {
              resolve();
            }
          });
        });

        const progressPercent = 30 + Math.round(((i + 1) / resolutions.length) * 50); // scales from 30% to 80%
        if(fbDb) await setDoc(doc(fbDb, "videos", videoId), { progress: progressPercent, status: "Converting" }, { merge: true });
      }

      // Write master.m3u8 playlist file referencing the relative resolution playlists
      const masterContent = `#EXTM3U\n#EXT-X-VERSION:3\n` + 
        `#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240\n240p.m3u8\n` +
        `#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p.m3u8\n` +
        `#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480\n480p.m3u8\n` +
        `#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720\n720p.m3u8\n` +
        `#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080p.m3u8\n`;
      
      fs.writeFileSync(path.join(hlsDir, "master.m3u8"), masterContent);
      console.log(`[Transcoder] Generated master playlist successfully for ${videoId}`);
      if(fbDb) await setDoc(doc(fbDb, "videos", videoId), { progress: 85, status: "Converting" }, { merge: true });
      
    } catch (err) {
       console.error("[Transcoder] FFmpeg Transcoding pipeline failed:", err);
    }
  }

  console.log(`[Storage] Uploading transcoded assets for ${videoId} to Firebase Cloud Storage...`);
  try {
     let mp4Url = "";
     let thumbUrl = "";
     let originalUrl = "";
     let hlsMasterUrl = "";

     // Original video
     const ogRef = storageRef(fbStorage, `workstation/${videoId}/${originalName}`);
     const ogBuffer = fs.readFileSync(sourcePath);
     await uploadBytes(ogRef, new Uint8Array(ogBuffer));
     originalUrl = await getDownloadURL(ogRef);

     // Thumbnail image
     if (fs.existsSync(thumbnailPath)) {
       const thumbRef = storageRef(fbStorage, `workstation/${videoId}/thumbnail.jpg`);
       const tbBuffer = fs.readFileSync(thumbnailPath);
       await uploadBytes(thumbRef, new Uint8Array(tbBuffer), { contentType: "image/jpeg" });
       thumbUrl = await getDownloadURL(thumbRef);
     }

     // MP4 compatible file
     if (fs.existsSync(compatibleMp4Path)) {
       const mp4Ref = storageRef(fbStorage, `workstation/${videoId}/compatible.mp4`);
       const mp4Buffer = fs.readFileSync(compatibleMp4Path);
       await uploadBytes(mp4Ref, new Uint8Array(mp4Buffer), { contentType: "video/mp4" });
       mp4Url = await getDownloadURL(mp4Ref);
     } else {
       mp4Url = originalUrl;
     }

     // HLS folder recursive upload
     const hlsDir = path.join(dir, "hls");
     if (fs.existsSync(hlsDir)) {
       console.log(`[Storage] Uploading HLS directory structure for ${videoId}`);
       await uploadDirectoryToStorage(hlsDir, `workstation/${videoId}/hls`, fbStorage);
       
       // Standard video stream URL is now set to our CORS-friendly proxy route
       hlsMasterUrl = `/api/videos/stream/${videoId}/hls/master.m3u8`;
     }

     if (fbDb) {
       await setDoc(doc(fbDb, "videos", videoId), {
          status: "Ready",
          progress: 100,
          url: hlsMasterUrl || mp4Url,
          downloadUrl: originalUrl
       }, { merge: true });
       if (thumbUrl) {
         await setDoc(doc(fbDb, "videos", videoId), { thumbnail: thumbUrl }, { merge: true });
       }
     }

     console.log(`[Storage] Successfully uploaded and recorded cloud URLs for ${videoId}`);
     
     // Cleanup local files immediately to save container disk space since it's uploaded
     fs.rmSync(dir, { recursive: true, force: true });
  } catch(err) {
     console.error("[Storage] Failed to upload files to Cloud Storage, falling back to Local ephemeral URLs", err);
     
     const originalFallback = `/uploads/${videoId}/${originalName}`;
     const mp4Fallback = fs.existsSync(compatibleMp4Path) ? `/uploads/${videoId}/compatible.mp4` : originalFallback;
     const thumbFallback = fs.existsSync(thumbnailPath) ? `/uploads/${videoId}/thumbnail.jpg` : "";
     const hlsMasterUrl = `/api/videos/stream/${videoId}/hls/master.m3u8`;
     
     if(fbDb) {
         await setDoc(doc(fbDb, "videos", videoId), { 
             status: "Ready", 
             progress: 100, 
             url: hlsMasterUrl, 
             downloadUrl: originalFallback,
             ...(thumbFallback ? { thumbnail: thumbFallback } : {})
         }, { merge: true });
     }
  }
}

async function startServer() {
  const app = express();

  const logFile = path.join(process.cwd(), "server.log");
  const logToLocalFile = (msg: string) => {
    const timestamp = new Date().toISOString();
    try {
      fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    } catch(e) {}
    console.log(`[ServerLog] ${msg}`);
  };

  // Parse payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // REST API: Proxy HLS streaming chunks from Firebase Storage
  app.get("/api/videos/stream/:videoId/hls/:file", async (req, res) => {
    const { videoId, file } = req.params;
    try {
      if (!fbStorage) {
        throw new Error("Firebase Storage reference is not initialized");
      }
      const fileRef = storageRef(fbStorage, `workstation/${videoId}/hls/${file}`);
      const buffer = await getBytes(fileRef);
      
      if (file.endsWith(".m3u8")) {
        res.setHeader("Content-Type", "application/x-mpegURL");
      } else if (file.endsWith(".ts")) {
        res.setHeader("Content-Type", "video/MP2T");
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // Cache files (especially .ts chunks) to allow instant playback
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      // Ephemeral filesystem fallback
      const localFile = path.join(UPLOADS_DIR, videoId, "hls", file);
      if (fs.existsSync(localFile)) {
        if (file.endsWith(".m3u8")) {
          res.setHeader("Content-Type", "application/x-mpegURL");
        } else if (file.endsWith(".ts")) {
          res.setHeader("Content-Type", "video/MP2T");
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.sendFile(localFile);
      }
      
      console.warn(`[Stream Proxy Warning] Failed streaming HLS file ${file} for video ${videoId}:`, err.message);
      res.status(404).send("Segment not found");
    }
  });

  // REST API: Proxy MP4 video file from Firebase Storage
  app.get("/api/videos/stream/:videoId/mp4", async (req, res) => {
    const { videoId } = req.params;
    try {
      if (!fbStorage) {
        throw new Error("Firebase Storage reference is not initialized");
      }
      const fileRef = storageRef(fbStorage, `workstation/${videoId}/compatible.mp4`);
      const buffer = await getBytes(fileRef);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      const localFile = path.join(UPLOADS_DIR, videoId, "compatible.mp4");
      if (fs.existsSync(localFile)) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.sendFile(localFile);
      }
      res.status(404).send("MP4 compatible source not found");
    }
  });

  // Logging API requests
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/videos")) {
      logToLocalFile(`INCOMING REQUEST: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
    }
    next();
  });

  // REST API: Chunked upload
  app.post("/api/videos/upload_chunk", upload.single("chunk"), (req, res) => {
    try {
      const videoId = req.body.id;
      const chunkIndex = parseInt(req.body.chunkIndex, 10);
      const totalChunks = parseInt(req.body.totalChunks, 10);
      
      if (!req.file) return res.status(400).json({ error: "Missing chunk file" });
      if (!videoId) return res.status(400).json({ error: "Missing videoId" });

      const dir = path.join(UPLOADS_DIR, videoId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const chunkPath = path.join(dir, `chunk_${chunkIndex}`);
      fs.renameSync(req.file.path, chunkPath);
      
      res.json({ success: true, chunkIndex });
    } catch(err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/videos/upload_finalize", async (req, res) => {
    const { id, originalName, title, description, category, uploadedBy, uploadedRole, totalChunks, size, type } = req.body;
    
    const dir = path.join(UPLOADS_DIR, id);
    const finalPath = path.join(dir, originalName);
    
    try {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(dir, `chunk_${i}`);
        if (fs.existsSync(chunkPath)) {
          const chunkData = fs.readFileSync(chunkPath);
          fs.appendFileSync(finalPath, chunkData);
          fs.unlinkSync(chunkPath); 
        }
      }
      
      const colors = ["#22d3ee", "#a78bfa", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];
      const displayTitle = title || "Untitled";
      const baseColor = colors[Math.abs(displayTitle.charCodeAt(0) || 0) % colors.length] || "#22d3ee";
      const escapedTitle = displayTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="400" height="225"><rect width="100%" height="100%" fill="#020617"/><text x="50%" y="50%" text-anchor="middle" fill="#f8fafc" font-size="16" font-family="sans-serif">${escapedTitle}</text><text x="50%" y="70%" text-anchor="middle" fill="${baseColor}" font-size="10" font-family="monospace">CONVERTING STAGE...</text></svg>`;
      const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

      const newVideo = {
        id,
        title: displayTitle,
        fileName: originalName,
        fileSize: size,
        fileType: type,
        uploadedBy: uploadedBy || "Crew Member",
        uploadedRole: uploadedRole || "Crew",
        description: description || "",
        category: category || "General",
        timestamp: new Date().toISOString(),
        thumbnail,
        status: "Converting",
        progress: 0,
        views: 0,
        downloads: 0,
        likes: 0,
        likedBy: [],
        url: "",
        downloadUrl: ""
      };

      if(fbDb) {
        try {
          await setDoc(doc(fbDb, "videos", id), newVideo);
        } catch(e) {
          console.error("Failed to allocate in cloud", e);
        }
      }

      transcodeVideo(id, originalName);
      
      res.json({ success: true, video: newVideo });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed assembling chunks" });
    }
  });

  // REST API: Get all videos list
  app.get("/api/videos", async (req, res) => {
    if (!fbDb) return res.json([]);
    try {
      const snap = await getDocs(collection(fbDb, "videos"));
      const videos = snap.docs.map(d => d.data());
      videos.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(videos);
    } catch(e) {
      res.status(500).json({ error: "DB Read Failed" });
    }
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
  app.get("/api/videos/status/:id", async (req, res) => {
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    const snap = await getDoc(doc(fbDb, "videos", req.params.id));
    if (!snap.exists()) {
      return res.status(404).json({ error: "Video record not found" });
    }
    const video = snap.data();
    res.json({ id: video.id, status: video.status, progress: video.progress });
  });

  // REST API: Edit video metadata
  app.post("/api/videos/:id/edit", async (req, res) => {
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    const { title, description, category, isPrivate } = req.body;
    
    const snap = await getDoc(doc(fbDb, "videos", req.params.id));
    if (!snap.exists()) return res.status(404).json({ error: "Video not found" });
    
    const updates: any = {};
    if(title) updates.title = title;
    if(description !== undefined) updates.description = description;
    if(category) updates.category = category;
    if(isPrivate !== undefined) updates.isPrivate = isPrivate;

    await updateDoc(doc(fbDb, "videos", req.params.id), updates);
    res.json({ success: true, video: { ...snap.data(), ...updates } });
  });

  // REST API: Increment analytics
  app.post("/api/videos/:id/views", async (req, res) => {
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    const snap = await getDoc(doc(fbDb, "videos", req.params.id));
    if(snap.exists()) {
      await updateDoc(doc(fbDb, "videos", req.params.id), { views: (snap.data().views || 0) + 1 });
    }
    res.json({ success: true });
  });

  // REST API: Like/Unlike Video
  app.post("/api/videos/:id/like", async (req, res) => {
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });

    const snap = await getDoc(doc(fbDb, "videos", req.params.id));
    if (!snap.exists()) return res.status(404).json({ error: "Video not found" });

    const video = snap.data();
    const likedBy = video.likedBy || [];
    const likedIndex = likedBy.indexOf(username);

    let newLikes = video.likes || 0;
    if (likedIndex > -1) {
      likedBy.splice(likedIndex, 1);
      newLikes = Math.max(0, newLikes - 1);
    } else {
      likedBy.push(username);
      newLikes += 1;
    }

    await updateDoc(doc(fbDb, "videos", req.params.id), { likes: newLikes, likedBy });
    res.json({ success: true, likes: newLikes, likedBy });
  });

  // REST API: Secure resumable download with original file name preservation
  app.get("/api/videos/:id/download", async (req, res) => {
    const { id } = req.params;
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    try {
      const snap = await getDoc(doc(fbDb, "videos", id));
      if (!snap.exists()) return res.status(404).json({ error: "Video not found in metadata registry" });
      const video = snap.data();
      const targetUrl = video.downloadUrl || video.url;
      
      if (!targetUrl) return res.status(404).json({ error: "Target URL missing" });

      await updateDoc(doc(fbDb, "videos", id), {
        downloads: (video.downloads || 0) + 1
      });
      res.redirect(targetUrl);
    } catch(err) {
      res.status(500).json({ error: "Download resolution failed" });
    }
  });

  // REST API: Auto-healing sync route from Client's Firestore
  app.post("/api/videos/sync", (req, res) => {
    res.json({ success: true }); // No longer needed as we use native firestore
  });

  // REST API: Upload new thumbnail base64
  app.post("/api/videos/:id/thumbnail", async (req, res) => {
    if(!fbDb) return res.status(404).json({ error: "No DB" });
    const { thumbnail } = req.body;
    if (!thumbnail) return res.status(400).json({ error: "Thumbnail is required" });

    await updateDoc(doc(fbDb, "videos", req.params.id), { thumbnail });
    res.json({ success: true });
  });

  // REST API: Delete Video
  app.delete("/api/videos/:id", async (req, res) => {
    const videoId = req.params.id;
    if(!fbDb) return res.status(404).json({ error: "No DB" });

    try {
      await deleteDoc(doc(fbDb, "videos", videoId));
      res.json({ success: true });
    } catch(err) {
      res.status(500).json({ error: "Delete failed" });
    }
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
