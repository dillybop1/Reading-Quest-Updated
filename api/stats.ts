import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_MILESTONE_STEP = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    const [statsResult, sessionsResult, minutesResult, booksResult] = await Promise.all([
      query("SELECT * FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1", [student.studentId]),
      query("SELECT COUNT(*)::int AS count FROM sessions WHERE student_id = $1", [student.studentId]),
      query("SELECT COALESCE(SUM(duration_minutes), 0)::int AS total FROM sessions WHERE student_id = $1", [student.studentId]),
      query("SELECT COUNT(*)::int AS count FROM books WHERE student_id = $1", [student.studentId]),
    ]);

    const stats = statsResult.rows[0] ?? {
      total_xp: 0,
      level: 1,
      coins: 0,
      total_coins_earned: 0,
    };
    const totalSessions = sessionsResult.rows[0]?.count ?? 0;
    const totalMinutes = minutesResult.rows[0]?.total ?? 0;
    const totalBooks = booksResult.rows[0]?.count ?? 0;
    const totalXp = Number(stats.total_xp ?? 0);
    const nextMilestoneXp = (Math.floor(totalXp / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP;

    return res.status(200).json({
      ...stats,
      total_sessions: totalSessions,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      total_books: totalBooks,
      next_milestone_xp: nextMilestoneXp,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
