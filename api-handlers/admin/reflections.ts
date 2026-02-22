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

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureSchema();

    const rows = await query(
      `
        SELECT
          sr.session_id,
          s.timestamp,
          st.class_code,
          st.nickname,
          b.title AS book_title,
          sr.question_index,
          sr.question_text,
          sr.answer_text
        FROM session_reflections sr
        JOIN sessions s ON s.id = sr.session_id
        JOIN students st ON st.id = sr.student_id
        LEFT JOIN books b ON b.id = sr.book_id
        ORDER BY s.timestamp DESC, sr.session_id DESC, sr.question_index ASC
        LIMIT 1200
      `
    );

    const bySession = new Map<
      number,
      {
        session_id: number;
        timestamp: string;
        class_code: string;
        nickname: string;
        book_title: string | null;
        answers: Array<{ question_index: number; question_text: string; answer_text: string }>;
      }
    >();

    for (const row of rows.rows) {
      const sessionId = Number(row.session_id);
      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, {
          session_id: sessionId,
          timestamp: row.timestamp,
          class_code: row.class_code,
          nickname: row.nickname,
          book_title: row.book_title ?? null,
          answers: [],
        });
      }

      bySession.get(sessionId)!.answers.push({
        question_index: Number(row.question_index) || 0,
        question_text: row.question_text ?? "",
        answer_text: row.answer_text ?? "",
      });
    }

    return res.status(200).json({
      reflections: Array.from(bySession.values()),
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
