import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "POST") {
      const { title, author, total_pages } = req.body ?? {};

      if (!title || !author || !Number.isFinite(total_pages)) {
        return res.status(400).json({ error: "Missing/invalid title, author, total_pages" });
      }

      // Deactivate any existing active book
      await query("UPDATE books SET is_active = false WHERE is_active = true");

      // Create new active book
      const created = await query(
        `INSERT INTO books (title, author, total_pages, current_page, is_active)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [title, author, total_pages, 0, true]
      );

      return res.status(200).json(created.rows[0]);
    }

    if (req.method === "GET") {
      const result = await query("SELECT * FROM books ORDER BY id DESC");
      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}