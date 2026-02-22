import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { resolveStudent } from "../_student.js";

const STICKER_KEYS = new Set([
  "dragon",
  "rocket",
  "crown",
  "owl",
  "lightning",
  "mountain",
  "bookworm",
  "shield",
]);

const RATING_KEYS = new Set(["loved_it", "good_read", "hard_for_me"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET" && req.method !== "PATCH") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    if (req.method === "GET") {
      const result = await query(
        `
          SELECT
            b.id::int AS book_id,
            b.title,
            b.author,
            COALESCE(b.total_pages, 0)::int AS total_pages,
            sbc.completion_number::int AS completion_number,
            sbc.sticker_key,
            sbc.rating_key,
            sbc.sticker_pos_x,
            sbc.sticker_pos_y,
            sbc.completed_at
          FROM student_book_completions sbc
          JOIN books b ON b.id = sbc.book_id
          WHERE sbc.student_id = $1
          ORDER BY sbc.completion_number DESC, sbc.completed_at DESC
        `,
        [student.studentId]
      );

      return res.status(200).json(result.rows);
    }

    if (req.method === "PATCH") {
      const completionNumber = Number(req.body?.completion_number);
      const stickerKeyRaw = typeof req.body?.sticker_key === "string" ? req.body.sticker_key.trim() : "";
      const ratingKeyRaw = typeof req.body?.rating_key === "string" ? req.body.rating_key.trim() : "";
      const stickerPosXRaw = req.body?.sticker_pos_x;
      const stickerPosYRaw = req.body?.sticker_pos_y;

      if (!Number.isFinite(completionNumber) || completionNumber < 1) {
        return res.status(400).json({ error: "Invalid completion_number" });
      }

      const stickerKey = stickerKeyRaw || null;
      const ratingKey = ratingKeyRaw || null;

      if (stickerKey && !STICKER_KEYS.has(stickerKey)) {
        return res.status(400).json({ error: "Invalid sticker_key" });
      }

      if (ratingKey && !RATING_KEYS.has(ratingKey)) {
        return res.status(400).json({ error: "Invalid rating_key" });
      }

      const stickerPosX = stickerPosXRaw == null ? null : Number(stickerPosXRaw);
      const stickerPosY = stickerPosYRaw == null ? null : Number(stickerPosYRaw);

      if (stickerPosX != null && (!Number.isFinite(stickerPosX) || stickerPosX < 0 || stickerPosX > 100)) {
        return res.status(400).json({ error: "Invalid sticker_pos_x" });
      }

      if (stickerPosY != null && (!Number.isFinite(stickerPosY) || stickerPosY < 0 || stickerPosY > 100)) {
        return res.status(400).json({ error: "Invalid sticker_pos_y" });
      }

      const updateResult = await query(
        `
          UPDATE student_book_completions
          SET sticker_key = $1, rating_key = $2, sticker_pos_x = $3, sticker_pos_y = $4
          WHERE student_id = $5 AND completion_number = $6
          RETURNING completion_number::int AS completion_number, sticker_key, rating_key, sticker_pos_x, sticker_pos_y
        `,
        [stickerKey, ratingKey, stickerPosX, stickerPosY, student.studentId, completionNumber]
      );

      if (!updateResult.rows.length) {
        return res.status(404).json({ error: "Completion record not found" });
      }

      return res.status(200).json(updateResult.rows[0]);
    }
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
