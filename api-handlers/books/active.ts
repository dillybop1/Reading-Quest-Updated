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
      const activeResult = await query(
        "SELECT * FROM books WHERE student_id = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
        [student.studentId]
      );
      const activeBook = activeResult.rows[0] ?? null;

      const activeCurrentPage = Number(activeBook?.current_page ?? 0);
      const activeTotalPages = Number(activeBook?.total_pages ?? 0);
      const activeBookCompleted =
        Number.isFinite(activeTotalPages) && activeTotalPages > 0 && activeCurrentPage >= activeTotalPages;

      if (activeBook?.id && activeBookCompleted) {
        await query("UPDATE books SET is_active = false WHERE id = $1 AND student_id = $2", [
          activeBook.id,
          student.studentId,
        ]);
      }

      const unfinishedResult = await query(
        `
          SELECT *
          FROM books
          WHERE student_id = $1
            AND (COALESCE(total_pages, 0) <= 0 OR COALESCE(current_page, 0) < COALESCE(total_pages, 0))
          ORDER BY is_active DESC, id DESC
          LIMIT 1
        `,
        [student.studentId]
      );
      const unfinishedBook = unfinishedResult.rows[0] ?? null;

      if (!unfinishedBook) {
        return res.status(200).json(null);
      }

      if (!unfinishedBook.is_active) {
        await query("UPDATE books SET is_active = false WHERE student_id = $1 AND is_active = true", [student.studentId]);
        const updated = await query("UPDATE books SET is_active = true WHERE id = $1 AND student_id = $2 RETURNING *", [
          unfinishedBook.id,
          student.studentId,
        ]);
        return res.status(200).json(updated.rows[0] ?? unfinishedBook);
      }

      return res.status(200).json(unfinishedBook);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
