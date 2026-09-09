import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Ensure global __dirname does not interfere with third-party ESM modules
if (typeof (globalThis as Record<string, unknown>).__dirname !== "undefined") {
  delete (globalThis as Record<string, unknown>).__dirname;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for accurate rate limiting behind Cloud Run/Nginx
  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json());

  // Rate limiting for high traffic
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: { trustProxy: false }, // Suppress the trust proxy warning since we set it at the app level
  });
  app.use("/api/", limiter);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy endpoint for file size to bypass CORS
  app.get("/api/proxy/file-size", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const headers: Record<string, string> = {};
      if (url.includes("b-cdn.net") && process.env.BUNNY_API_KEY) {
        headers["AccessKey"] = process.env.BUNNY_API_KEY;
      }

      // Try HEAD first as it's most efficient
      const response = await fetch(url, { method: "HEAD", headers, signal: AbortSignal.timeout(5000) });
      let contentLength = response.headers.get("content-length");
      
      // Fallback to GET with Range if HEAD fails or doesn't provide size
      if (!contentLength || response.status >= 400 || response.status === 405) {
        const getResponse = await fetch(url, { 
          method: "GET", 
          headers: { ...headers, "Range": "bytes=0-0" },
          signal: AbortSignal.timeout(5000)
        });
        
        const contentRange = getResponse.headers.get("content-range");
        if (contentRange) {
          // Format: bytes 0-0/1234567
          contentLength = contentRange.split("/")?.[1] || null;
        } else {
          contentLength = getResponse.headers.get("content-length");
        }
      }

      if (contentLength && !isNaN(parseInt(contentLength))) {
        return res.json({ contentLength });
      }
      
      return res.status(404).json({ error: "Could not determine file size" });
    } catch (error) {
      console.error(`File size proxy error for ${url}:`, error);
      return res.status(500).json({ error: "Failed to fetch file size" });
    }
  });

  // Placeholder for other API routes (auth, movies, etc.)
  // In a real production app, we would use JWT and MongoDB/Firestore here.
  // Since we are using Firebase, most data fetching can happen on the client,
  // but we can proxy some requests if needed.

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
