import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    const result = await query("SELECT * FROM user_stats LIMIT 1");

    if (result.rows.length === 0) {
      // Create default stats if none exist
      const insert = await query(
        "INSERT INTO user_stats (total_xp, level) VALUES ($1, $2) RETURNING *",
        [0, 1]
      );
      return res.status(200).json(insert.rows[0]);
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}