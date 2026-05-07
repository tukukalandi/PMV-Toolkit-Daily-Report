import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webappUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

    if (!webappUrl) {
      throw new Error("GOOGLE_SHEET_WEBAPP_URL is not configured in Vercel Environment Variables");
    }

    // Forward the request to the Apps Script Web App
    const response = await fetch(webappUrl, {
      method: "POST",
      body: JSON.stringify(req.body),
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    console.error("Sheets Sync Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync to sheets" });
  }
}
