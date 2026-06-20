import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection, getDoc, updateDoc } from "firebase/firestore";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const PORT = 3000;

let fbApp: any, fbAuth: any, fbDb: any;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  fbApp = initializeApp(firebaseConfig);
  fbAuth = getAuth(fbApp);
  fbDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

  signInAnonymously(fbAuth).catch(err => console.error("Firebase Backend Auth Error:", err));
} catch (configErr) {
  console.error("Critical: Could not load Firebase config locally on Server.", configErr);
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
