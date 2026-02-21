import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_PER_LEVEL = 500;
const XP_MILESTONE_STEP = 500;
const COIN_DIVISOR = 10;
const MILESTONE_BONUS_COINS = 75;
const MAX_REFLECTION_LENGTH = 4000;
const STREAK_XP_BONUS_PER_DAY = 0.05;
const STREAK_XP_BONUS_MAX = 0.5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const OVERTIME_COIN_REWARD_PER_MINUTE = 3;

const parseReflectionEntries = (questions: unknown, answers: unknown) => {
  const questionList = Array.isArray(questions) ? questions : [];
  const answerList = Array.isArray(answers) ? answers : [];
  const maxLen = Math.max(questionList.length, answerList.length);
  const entries: Array<{ question_index: number; question_text: string; answer_text: string }> = [];

  for (let i = 0; i < maxLen; i += 1) {
    const questionRaw = questionList[i];
    const answerRaw = answerList[i];
    const questionText = typeof questionRaw === "string" ? questionRaw.trim() : "";
    const answerText = typeof answerRaw === "string" ? answerRaw.trim() : "";

    if (!questionText && !answerText) continue;

    entries.push({
      question_index: i,
      question_text: (questionText || `Question ${i + 1}`).slice(0, MAX_REFLECTION_LENGTH),
      answer_text: answerText.slice(0, MAX_REFLECTION_LENGTH),
    });
  }

  return entries;
};

const getSessionCoinRewards = (previousXp: number, xpEarned: number) => {
  const safePreviousXp = Math.max(0, Math.floor(previousXp || 0));
  const safeXpEarned = Math.max(0, Math.floor(xpEarned || 0));

  const baseCoins = Math.max(1, Math.floor(safeXpEarned / COIN_DIVISOR));
  const milestonesCrossed =
    Math.floor((safePreviousXp + safeXpEarned) / XP_MILESTONE_STEP) - Math.floor(safePreviousXp / XP_MILESTONE_STEP);
  const milestoneCoins = Math.max(0, milestonesCrossed) * MILESTONE_BONUS_COINS;

  return {
    baseCoins,
    milestoneCoins,
    totalCoins: baseCoins + milestoneCoins,
    milestonesCrossed: Math.max(0, milestonesCrossed),
  };
};

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

const getStreakXpMultiplier = (streakDays: number) => {
  const safeStreak = Math.max(1, Math.floor(streakDays || 1));
  const bonus = Math.min(STREAK_XP_BONUS_MAX, Math.max(0, safeStreak - 1) * STREAK_XP_BONUS_PER_DAY);
  return 1 + bonus;
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

    if (req.method === "POST") {
      const {
        book_id,
        start_page,
        end_page,
        chapters_finished,
        duration_minutes,
        goal_minutes,
        xp_earned,
        questions,
        answers,
      } = req.body ?? {};

      if (
        !Number.isFinite(book_id) ||
        !Number.isFinite(start_page) ||
        !Number.isFinite(end_page) ||
        !Number.isFinite(chapters_finished) ||
        !Number.isFinite(duration_minutes) ||
        (goal_minutes != null && !Number.isFinite(goal_minutes)) ||
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

      const streakDays = await touchStudentStreak(student.studentId);
      const streakMultiplier = getStreakXpMultiplier(streakDays);
      const safeDurationMinutes = Math.max(0, Math.floor(Number(duration_minutes)));
      const safeGoalMinutes =
        goal_minutes == null ? safeDurationMinutes : Math.max(0, Math.floor(Number(goal_minutes)));
      const overtimeMinutes = Math.max(0, safeDurationMinutes - safeGoalMinutes);
      const overtimeBonusCoins = overtimeMinutes * OVERTIME_COIN_REWARD_PER_MINUTE;
      const submittedXp = Math.max(0, Math.floor(Number(xp_earned)));
      const boostedXpEarned = Math.max(0, Math.round(submittedXp * streakMultiplier));

      const session = await query(
        `INSERT INTO sessions
         (book_id, student_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [book_id, student.studentId, start_page, end_page, chapters_finished, safeDurationMinutes, boostedXpEarned]
      );

      const sessionId = session.rows[0]?.id;
      const reflectionEntries = parseReflectionEntries(questions, answers);
      if (Number.isFinite(sessionId) && reflectionEntries.length > 0) {
        for (const entry of reflectionEntries) {
          await query(
            `
              INSERT INTO session_reflections
              (session_id, student_id, book_id, question_index, question_text, answer_text)
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
              sessionId,
              student.studentId,
              book_id,
              entry.question_index,
              entry.question_text,
              entry.answer_text,
            ]
          );
        }
      }

      // Update book current page
      await query("UPDATE books SET current_page = $1 WHERE id = $2 AND student_id = $3", [
        end_page,
        book_id,
        student.studentId,
      ]);

      const statsBefore = await query(
        "SELECT total_xp, coins, total_coins_earned FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1",
        [student.studentId]
      );
      const previousXp = Number(statsBefore.rows[0]?.total_xp ?? 0);
      const previousCoins = Number(statsBefore.rows[0]?.coins ?? 0);
      const previousTotalCoinsEarned = Number(statsBefore.rows[0]?.total_coins_earned ?? 0);
      const safeXpEarned = boostedXpEarned;
      const coinRewards = getSessionCoinRewards(previousXp, safeXpEarned);
      const totalCoinsEarned = coinRewards.totalCoins + overtimeBonusCoins;

      const totalXp = previousXp + safeXpEarned;
      const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;
      const newCoins = previousCoins + totalCoinsEarned;
      const newTotalCoinsEarned = previousTotalCoinsEarned + totalCoinsEarned;

      await query(
        `
          UPDATE user_stats
          SET total_xp = $1, level = $2, coins = $3, total_coins_earned = $4
          WHERE student_id = $5
        `,
        [totalXp, newLevel, newCoins, newTotalCoinsEarned, student.studentId]
      );

      return res.status(200).json({
        session: session.rows[0],
        total_xp: totalXp,
        level: newLevel,
        coins: newCoins,
        xp_earned: safeXpEarned,
        streak_days: streakDays,
        streak_multiplier: streakMultiplier,
        coins_earned: totalCoinsEarned,
        milestone_bonus_coins: coinRewards.milestoneCoins,
        overtime_bonus_coins: overtimeBonusCoins,
        overtime_minutes: overtimeMinutes,
        milestones_reached: coinRewards.milestonesCrossed,
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
