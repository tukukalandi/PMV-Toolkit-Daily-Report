import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Google Sheets Sync via Apps Script
  app.post("/api/sync-to-sheet", async (req, res) => {
    try {
      const webappUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

      if (!webappUrl) {
        throw new Error("GOOGLE_SHEET_WEBAPP_URL is not configured");
      }

      const response = await fetch(webappUrl, {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error("Sheets Sync Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync to sheets" });
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

startServer();
