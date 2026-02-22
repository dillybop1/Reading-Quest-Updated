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

      // Keep existing books active state; first book becomes active by default.
      const existingActive = await query(
        "SELECT id FROM books WHERE student_id = $1 AND is_active = true LIMIT 1",
        [student.studentId]
      );
      const shouldBeActive = existingActive.rows.length === 0;

      // Create new tracked book
      const created = await query(
        `INSERT INTO books (title, author, total_pages, current_page, is_active, student_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [title, author, total_pages, 0, shouldBeActive, student.studentId]
      );

      return res.status(200).json(created.rows[0]);
    }

    if (req.method === "GET") {
      const result = await query(
        `
          SELECT *
          FROM books
          WHERE student_id = $1
            AND (COALESCE(total_pages, 0) <= 0 OR COALESCE(current_page, 0) < COALESCE(total_pages, 0))
          ORDER BY id DESC
        `,
        [student.studentId]
      );
      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
