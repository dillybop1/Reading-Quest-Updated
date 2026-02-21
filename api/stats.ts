import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const result = await query("SELECT * FROM user_stats ORDER BY id ASC LIMIT 1");

    if (result.rows.length === 0) {
      const insert = await query(
        "INSERT INTO user_stats (total_xp, level) VALUES ($1, $2) RETURNING *",
        [0, 1]
      );
      return res.status(200).json(insert.rows[0]);
    }

    return res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}