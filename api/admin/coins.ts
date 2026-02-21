import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";

const toPositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureSchema();

    const studentId = toPositiveInt(req.body?.student_id);
    const coins = toPositiveInt(req.body?.coins);

    if (!studentId) {
      return res.status(400).json({ error: "Invalid student_id" });
    }

    if (!coins) {
      return res.status(400).json({ error: "Invalid coins amount" });
    }

    const studentCheck = await query("SELECT id FROM students WHERE id = $1 LIMIT 1", [studentId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const updated = await query(
      `
        UPDATE user_stats
        SET
          coins = COALESCE(coins, 0) + $1,
          total_coins_earned = COALESCE(total_coins_earned, 0) + $1
        WHERE student_id = $2
        RETURNING student_id, COALESCE(coins, 0)::int AS coins, COALESCE(total_coins_earned, 0)::int AS total_coins_earned
      `,
      [coins, studentId]
    );

    if (updated.rows.length === 0) {
      const inserted = await query(
        `
          INSERT INTO user_stats (student_id, total_xp, level, coins, total_coins_earned)
          VALUES ($1, 0, 1, $2, $2)
          RETURNING student_id, coins::int AS coins, total_coins_earned::int AS total_coins_earned
        `,
        [studentId, coins]
      );

      return res.status(200).json({
        student_id: studentId,
        granted_coins: coins,
        coins: inserted.rows[0]?.coins ?? coins,
        total_coins_earned: inserted.rows[0]?.total_coins_earned ?? coins,
      });
    }

    return res.status(200).json({
      student_id: studentId,
      granted_coins: coins,
      coins: updated.rows[0]?.coins ?? 0,
      total_coins_earned: updated.rows[0]?.total_coins_earned ?? 0,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
