import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await ensureSchema();

    const classesResult = await query(
      `
        SELECT class_code, COUNT(*)::int AS student_count
        FROM students
        GROUP BY class_code
        ORDER BY class_code
      `
    );

    const studentsResult = await query(
      `
        SELECT
          s.id,
          s.class_code,
          s.nickname,
          s.created_at,
          COALESCE(us.total_xp, 0)::int AS total_xp,
          COALESCE(us.level, 1)::int AS level,
          COALESCE(us.coins, 0)::int AS coins,
          COALESCE(us.total_coins_earned, 0)::int AS total_coins_earned,
          COALESCE(ss.total_sessions, 0)::int AS total_sessions,
          COALESCE(ss.total_minutes, 0)::int AS total_minutes,
          ab.title AS active_book,
          ab.current_page,
          ab.total_pages
        FROM students s
        LEFT JOIN user_stats us ON us.student_id = s.id
        LEFT JOIN (
          SELECT
            student_id,
            COUNT(*) AS total_sessions,
            COALESCE(SUM(duration_minutes), 0) AS total_minutes
          FROM sessions
          GROUP BY student_id
        ) ss ON ss.student_id = s.id
        LEFT JOIN (
          SELECT DISTINCT ON (student_id)
            student_id,
            title,
            current_page,
            total_pages
          FROM books
          WHERE is_active = true
          ORDER BY student_id, id DESC
        ) ab ON ab.student_id = s.id
        ORDER BY s.class_code, s.nickname
      `
    );

    return res.status(200).json({
      classes: classesResult.rows,
      students: studentsResult.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
