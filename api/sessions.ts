import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === "POST") {
      const {
        book_id,
        start_page,
        end_page,
        chapters_finished,
        duration_minutes,
        xp_earned,
      } = req.body;

      const session = await query(
        `INSERT INTO sessions 
        (book_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *`,
        [
          book_id,
          start_page,
          end_page,
          chapters_finished,
          duration_minutes,
          xp_earned,
        ]
      );

      await query(
        "UPDATE books SET current_page = $1 WHERE id = $2",
        [end_page, book_id]
      );

      await query(
        "UPDATE user_stats SET total_xp = total_xp + $1",
        [xp_earned]
      );

      return res.status(200).json(session.rows[0]);
    }

    const result = await query("SELECT * FROM sessions ORDER BY timestamp DESC");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sessions API failed" });
  }
}