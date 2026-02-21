import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    const result = await query(
      "SELECT * FROM books WHERE is_active = true LIMIT 1"
    );

    res.status(200).json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active book" });
  }
}