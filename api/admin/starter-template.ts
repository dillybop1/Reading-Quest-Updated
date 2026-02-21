import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";
import { parseStudentIdentity } from "../_student.js";

const ROOM_POSITION_MIN = 2;
const ROOM_POSITION_MAX = 98;
const ROOM_Z_INDEX_MIN = 1;
const ROOM_Z_INDEX_MAX = 999;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeTemplateRow = (row: any) => {
  const posX = Number(row.pos_x);
  const posY = Number(row.pos_y);
  const zIndex = Number.parseInt(String(row.z_index), 10);
  return {
    key: String(row.item_key),
    pos_x: Number.isFinite(posX) ? clamp(posX, ROOM_POSITION_MIN, ROOM_POSITION_MAX) : 50,
    pos_y: Number.isFinite(posY) ? clamp(posY, ROOM_POSITION_MIN, ROOM_POSITION_MAX) : 50,
    z_index: Number.isFinite(zIndex) ? clamp(zIndex, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX) : ROOM_Z_INDEX_MIN,
  };
};

const loadStarterTemplate = async () => {
  const templateResult = await query(
    `
      SELECT item_key, pos_x, pos_y, z_index
      FROM room_starter_template_items
      ORDER BY sort_order ASC, id ASC
    `
  );

  return templateResult.rows.map(normalizeTemplateRow);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    await ensureSchema();

    if (req.method === "GET") {
      const template = await loadStarterTemplate();
      return res.status(200).json({
        item_count: template.length,
        items: template,
        generated_at: new Date().toISOString(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const parsedIdentity = parseStudentIdentity(req);
    if ("error" in parsedIdentity) {
      return res.status(400).json({ error: parsedIdentity.error });
    }

    const studentResult = await query("SELECT id FROM students WHERE class_code = $1 AND nickname = $2 LIMIT 1", [
      parsedIdentity.classCode,
      parsedIdentity.nickname,
    ]);
    const sourceStudentId = Number(studentResult.rows[0]?.id ?? 0);
    if (!Number.isFinite(sourceStudentId) || sourceStudentId <= 0) {
      return res.status(404).json({ error: "Student not found for starter template source" });
    }

    const equippedItemsResult = await query(
      `
        SELECT item_key, pos_x, pos_y, z_index
        FROM student_room_items
        WHERE student_id = $1
          AND COALESCE(is_equipped, false) = true
        ORDER BY COALESCE(z_index, 0) ASC, id ASC
      `,
      [sourceStudentId]
    );

    if (!equippedItemsResult.rows.length) {
      return res.status(400).json({ error: "Source student has no equipped room items to save" });
    }

    const normalizedTemplate = equippedItemsResult.rows.map(normalizeTemplateRow);

    await query("DELETE FROM room_starter_template_items");

    await Promise.all(
      normalizedTemplate.map((item, index) =>
        query(
          `
            INSERT INTO room_starter_template_items (item_key, pos_x, pos_y, z_index, sort_order)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [item.key, item.pos_x, item.pos_y, item.z_index, index]
        )
      )
    );

    return res.status(200).json({
      ok: true,
      item_count: normalizedTemplate.length,
      source: {
        class_code: parsedIdentity.classCode,
        nickname: parsedIdentity.nickname,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}

