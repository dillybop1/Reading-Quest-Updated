import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_MILESTONE_STEP = 500;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getTodayDateString = () => new Date().toISOString().slice(0, 10);
const parseIsoDateMs = (value: string) => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeNextStreak = (currentStreak: number, lastActiveDate: string | null | undefined, today: string) => {
  const safeCurrentStreak = Math.max(1, Math.floor(currentStreak || 1));
  const normalizedLastActive = typeof lastActiveDate === "string" ? lastActiveDate.trim().slice(0, 10) : "";

  if (!normalizedLastActive) {
    return { streakDays: safeCurrentStreak, lastActiveDate: today, changed: true };
  }

  if (normalizedLastActive === today) {
    return { streakDays: safeCurrentStreak, lastActiveDate: normalizedLastActive, changed: false };
  }

  const lastMs = parseIsoDateMs(normalizedLastActive);
  const todayMs = parseIsoDateMs(today);
  if (!Number.isFinite(lastMs) || !Number.isFinite(todayMs)) {
    return { streakDays: 1, lastActiveDate: today, changed: true };
  }

  const dayDiff = Math.floor((todayMs - lastMs) / ONE_DAY_MS);
  if (dayDiff === 1) {
    return { streakDays: safeCurrentStreak + 1, lastActiveDate: today, changed: true };
  }

  if (dayDiff > 1) {
    return { streakDays: 1, lastActiveDate: today, changed: true };
  }

  return { streakDays: safeCurrentStreak, lastActiveDate: normalizedLastActive, changed: false };
};

const touchStudentStreak = async (studentId: number) => {
  const today = getTodayDateString();
  const currentStats = await query(
    "SELECT streak_days, last_active_date::text AS last_active_date FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1",
    [studentId]
  );
  const currentStreak = Number(currentStats.rows[0]?.streak_days ?? 1);
  const lastActiveDate = (currentStats.rows[0]?.last_active_date as string | null | undefined) ?? null;
  const next = computeNextStreak(currentStreak, lastActiveDate, today);

  if (next.changed) {
    await query("UPDATE user_stats SET streak_days = $1, last_active_date = $2 WHERE student_id = $3", [
      next.streakDays,
      next.lastActiveDate,
      studentId,
    ]);
  }

  return next.streakDays;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    const streakDays = await touchStudentStreak(student.studentId);

    const [statsResult, sessionsResult, minutesResult, booksResult] = await Promise.all([
      query("SELECT * FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1", [student.studentId]),
      query("SELECT COUNT(*)::int AS count FROM sessions WHERE student_id = $1", [student.studentId]),
      query("SELECT COALESCE(SUM(duration_minutes), 0)::int AS total FROM sessions WHERE student_id = $1", [student.studentId]),
      query("SELECT COUNT(*)::int AS count FROM student_book_completions WHERE student_id = $1", [student.studentId]),
    ]);

    const stats = statsResult.rows[0] ?? {
      total_xp: 0,
      level: 1,
      coins: 0,
      total_coins_earned: 0,
      streak_days: 1,
    };
    const totalSessions = sessionsResult.rows[0]?.count ?? 0;
    const totalMinutes = minutesResult.rows[0]?.total ?? 0;
    const totalBooks = booksResult.rows[0]?.count ?? 0;
    const totalXp = Number(stats.total_xp ?? 0);
    const nextMilestoneXp = (Math.floor(totalXp / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP;

    return res.status(200).json({
      ...stats,
      streak_days: Math.max(1, Number(stats.streak_days ?? streakDays ?? 1)),
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
