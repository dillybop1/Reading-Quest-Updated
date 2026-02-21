import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === "POST") {
      const { title, author, total_pages } = req.body;

      const result = await query(
        "INSERT INTO books (title, author, total_pages, current_page, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [title, author, total_pages, 0, true]
      );

      return res.status(200).json(result.rows[0]);
    }

    const result = await query("SELECT * FROM books");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Books API failed" });
  }
}