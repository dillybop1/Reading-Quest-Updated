import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_PER_LEVEL = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    if (req.method === "POST") {
      const {
        book_id,
        start_page,
        end_page,
        chapters_finished,
        duration_minutes,
        xp_earned,
      } = req.body ?? {};

      if (
        !Number.isFinite(book_id) ||
        !Number.isFinite(start_page) ||
        !Number.isFinite(end_page) ||
        !Number.isFinite(chapters_finished) ||
        !Number.isFinite(duration_minutes) ||
        !Number.isFinite(xp_earned)
      ) {
        return res.status(400).json({ error: "Invalid session payload" });
      }

      const bookResult = await query("SELECT id FROM books WHERE id = $1 AND student_id = $2 LIMIT 1", [
        book_id,
        student.studentId,
      ]);
      if (bookResult.rows.length === 0) {
        return res.status(404).json({ error: "Book not found for this student" });
      }

      const session = await query(
        `INSERT INTO sessions
         (book_id, student_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [book_id, student.studentId, start_page, end_page, chapters_finished, duration_minutes, xp_earned]
      );

      // Update book current page
      await query("UPDATE books SET current_page = $1 WHERE id = $2 AND student_id = $3", [
        end_page,
        book_id,
        student.studentId,
      ]);

      // Update user XP + level
      const stats = await query(
        "UPDATE user_stats SET total_xp = total_xp + $1 WHERE student_id = $2 RETURNING *",
        [xp_earned, student.studentId]
      );

      const totalXp = stats.rows[0]?.total_xp ?? 0;
      const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;

      await query("UPDATE user_stats SET level = $1 WHERE student_id = $2", [newLevel, student.studentId]);

      return res.status(200).json({
        session: session.rows[0],
        total_xp: totalXp,
        level: newLevel,
      });
    }

    if (req.method === "GET") {
      const result = await query("SELECT * FROM sessions WHERE student_id = $1 ORDER BY timestamp DESC", [
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
