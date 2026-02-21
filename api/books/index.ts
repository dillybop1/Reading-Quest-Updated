import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { resolveStudent } from "../_student.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    if (req.method === "POST") {
      const { title, author, total_pages } = req.body ?? {};

      if (!title || !author || !Number.isFinite(total_pages)) {
        return res.status(400).json({ error: "Missing/invalid title, author, total_pages" });
      }

      // Deactivate any existing active book
      await query("UPDATE books SET is_active = false WHERE student_id = $1 AND is_active = true", [
        student.studentId,
      ]);

      // Create new active book
      const created = await query(
        `INSERT INTO books (title, author, total_pages, current_page, is_active, student_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [title, author, total_pages, 0, true, student.studentId]
      );

      return res.status(200).json(created.rows[0]);
    }

    if (req.method === "GET") {
      const result = await query("SELECT * FROM books WHERE student_id = $1 ORDER BY id DESC", [
        student.studentId,
      ]);
      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
