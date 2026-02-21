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
      const { book_id } = req.body ?? {};
      if (!Number.isFinite(book_id)) {
        return res.status(400).json({ error: "Invalid book_id" });
      }

      const existing = await query("SELECT id FROM books WHERE id = $1 AND student_id = $2 LIMIT 1", [
        book_id,
        student.studentId,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Book not found for this student" });
      }

      await query("UPDATE books SET is_active = false WHERE student_id = $1 AND is_active = true", [
        student.studentId,
      ]);

      const updated = await query(
        "UPDATE books SET is_active = true WHERE id = $1 AND student_id = $2 RETURNING *",
        [book_id, student.studentId]
      );

      return res.status(200).json(updated.rows[0] ?? null);
    }

    if (req.method === "GET") {
      const result = await query(
        "SELECT * FROM books WHERE student_id = $1 AND is_active = true LIMIT 1",
        [student.studentId]
      );

      return res.status(200).json(result.rows[0] || null);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
