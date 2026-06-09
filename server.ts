import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as googleTTS from 'google-tts-api';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint to fetch audio from Google without CORS issues
  app.get("/api/proxy-tts", async (req, res) => {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: {
          'Referer': 'https://translate.google.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      res.set('Content-Type', 'audio/mpeg');
      response.data.pipe(res);
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: "Failed to proxy audio" });
    }
  });

  // API Endpoint for TTS with Translation
  app.post("/api/tts", async (req, res) => {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const langMap: Record<string, string> = {
      "English": "en",
      "Hindi": "hi",
      "Kannada": "kn",
      "Telugu": "te",
      "Tamil": "ta"
    };

    const targetLangCode = langMap[language] || "en";
    
    // Generate TTS URLs for the text provided by the client
    try {
      const results = googleTTS.getAllAudioUrls(text.substring(0, 2000), {
        lang: targetLangCode,
        slow: false,
        host: 'https://translate.google.com',
      });

      // Construct proxied URLs
      const proxiedResults = results.map(item => ({
        ...item,
        url: `/api/proxy-tts?url=${encodeURIComponent(item.url)}`
      }));

      res.json({ 
        urls: proxiedResults,
        translatedText: language !== "English" ? text : null 
      });
    } catch (error) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
