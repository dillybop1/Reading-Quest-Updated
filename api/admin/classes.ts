import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";

const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const normalizeClassCode = (value: unknown) => (typeof value === "string" ? value : "").trim().toUpperCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    await ensureSchema();

    const classCode = normalizeClassCode(req.body?.class_code);
    if (!CLASS_CODE_REGEX.test(classCode)) {
      return res.status(400).json({ error: "Invalid class_code format" });
    }

    const deleted = await query(
      `
        WITH target_students AS (
          SELECT id FROM students WHERE class_code = $1
        ),
        removed_sessions AS (
          DELETE FROM sessions
          WHERE student_id IN (SELECT id FROM target_students)
          RETURNING 1
        ),
        removed_books AS (
          DELETE FROM books
          WHERE student_id IN (SELECT id FROM target_students)
          RETURNING 1
        ),
        removed_stats AS (
          DELETE FROM user_stats
          WHERE student_id IN (SELECT id FROM target_students)
          RETURNING 1
        ),
        removed_students AS (
          DELETE FROM students
          WHERE class_code = $1
          RETURNING 1
        )
        SELECT
          $1::text AS class_code,
          (SELECT COUNT(*)::int FROM removed_students) AS deleted_students,
          (SELECT COUNT(*)::int FROM removed_sessions) AS deleted_sessions,
          (SELECT COUNT(*)::int FROM removed_books) AS deleted_books,
          (SELECT COUNT(*)::int FROM removed_stats) AS deleted_stats
      `,
      [classCode]
    );

    return res.status(200).json(
      deleted.rows[0] ?? {
        class_code: classCode,
        deleted_students: 0,
        deleted_sessions: 0,
        deleted_books: 0,
        deleted_stats: 0,
      }
    );
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
