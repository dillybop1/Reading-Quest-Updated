import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";

const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const NICKNAME_REGEX = /^[A-Za-z0-9 _.-]{2,24}$/;

const normalizeClassCode = (value: unknown) => (typeof value === "string" ? value : "").trim().toUpperCase();
const toPositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseNicknames = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await ensureSchema();

    if (req.method === "POST") {
      const classCode = normalizeClassCode(req.body?.class_code);
      const nicknames = parseNicknames(req.body?.nicknames);

      if (!CLASS_CODE_REGEX.test(classCode)) {
        return res.status(400).json({ error: "Invalid class_code format" });
      }

      if (nicknames.length === 0) {
        return res.status(400).json({ error: "Provide at least one nickname" });
      }

      const uniqueNicknames = Array.from(new Set(nicknames));
      const invalidNicknames = uniqueNicknames.filter((nickname) => !NICKNAME_REGEX.test(nickname));
      const validNicknames = uniqueNicknames.filter((nickname) => NICKNAME_REGEX.test(nickname));

      let createdCount = 0;
      let existingCount = 0;

      for (const nickname of validNicknames) {
        const inserted = await query(
          `
            INSERT INTO students (class_code, nickname)
            VALUES ($1, $2)
            ON CONFLICT (class_code, nickname) DO NOTHING
            RETURNING id
          `,
          [classCode, nickname]
        );

        let studentId = inserted.rows[0]?.id;
        if (Number.isFinite(studentId)) {
          createdCount += 1;
        } else {
          existingCount += 1;
          const existing = await query(
            "SELECT id FROM students WHERE class_code = $1 AND nickname = $2 LIMIT 1",
            [classCode, nickname]
          );
          studentId = existing.rows[0]?.id;
        }

        if (Number.isFinite(studentId)) {
          await query(
            `
              INSERT INTO user_stats (student_id, total_xp, level)
              VALUES ($1, 0, 1)
              ON CONFLICT (student_id) DO NOTHING
            `,
            [studentId]
          );
        }
      }

      return res.status(200).json({
        class_code: classCode,
        created_count: createdCount,
        existing_count: existingCount,
        invalid_nicknames: invalidNicknames,
      });
    }

    if (req.method === "DELETE") {
      const studentId = toPositiveInt(req.body?.student_id);
      if (!studentId) {
        return res.status(400).json({ error: "Invalid student_id" });
      }

      const deleted = await query(
        `
          WITH removed_sessions AS (
            DELETE FROM sessions WHERE student_id = $1 RETURNING 1
          ),
          removed_books AS (
            DELETE FROM books WHERE student_id = $1 RETURNING 1
          ),
          removed_stats AS (
            DELETE FROM user_stats WHERE student_id = $1 RETURNING 1
          ),
          removed_student AS (
            DELETE FROM students WHERE id = $1 RETURNING 1
          )
          SELECT
            (SELECT COUNT(*)::int FROM removed_student) AS deleted_students,
            (SELECT COUNT(*)::int FROM removed_sessions) AS deleted_sessions,
            (SELECT COUNT(*)::int FROM removed_books) AS deleted_books,
            (SELECT COUNT(*)::int FROM removed_stats) AS deleted_stats
        `,
        [studentId]
      );

      const result = deleted.rows[0] ?? {
        deleted_students: 0,
        deleted_sessions: 0,
        deleted_books: 0,
        deleted_stats: 0,
      };

      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
