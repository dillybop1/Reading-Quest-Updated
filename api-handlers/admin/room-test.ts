import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_db.js";
import { ensureSchema } from "../_schema.js";
import { requireAdmin } from "../_admin.js";

const toPositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toOptionalClampedFloat = (value: unknown, min: number, max: number) => {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
};

const toOptionalClampedInt = (value: unknown, min: number, max: number) => {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
};
const toUniqueItemKeys = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized));
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
    const itemKey = typeof req.body?.item_key === "string" ? req.body.item_key.trim() : "";
    const itemKeys = toUniqueItemKeys(req.body?.item_keys);
    const keysToGrant = itemKeys.length > 0 ? itemKeys : itemKey ? [itemKey] : [];
    const equip = req.body?.equip === undefined ? true : Boolean(req.body.equip);
    const posX = toOptionalClampedFloat(req.body?.pos_x, 2, 98);
    const posY = toOptionalClampedFloat(req.body?.pos_y, 2, 98);
    const zIndex = toOptionalClampedInt(req.body?.z_index, 1, 999);

    if (!studentId) {
      return res.status(400).json({ error: "Invalid student_id" });
    }

    if (keysToGrant.length === 0) {
      return res.status(400).json({ error: "Invalid item_key/item_keys" });
    }

    const studentCheck = await query("SELECT id FROM students WHERE id = $1 LIMIT 1", [studentId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const upsertResult = await query(
      `
        INSERT INTO student_room_items (student_id, item_key, is_equipped, pos_x, pos_y, z_index)
        SELECT
          $1,
          grant_row.item_key,
          $3,
          $4,
          $5,
          $6
        FROM UNNEST($2::text[]) AS grant_row(item_key)
        ON CONFLICT (student_id, item_key)
        DO UPDATE SET
          is_equipped = CASE WHEN $3 THEN true ELSE student_room_items.is_equipped END,
          pos_x = COALESCE($4, student_room_items.pos_x),
          pos_y = COALESCE($5, student_room_items.pos_y),
          z_index = COALESCE($6, student_room_items.z_index)
        RETURNING item_key
      `,
      [studentId, keysToGrant, equip, posX, posY, zIndex]
    );

    const counts = await query(
      `
        SELECT
          COUNT(*)::int AS owned_count,
          COUNT(*) FILTER (WHERE is_equipped = true)::int AS equipped_count
        FROM student_room_items
        WHERE student_id = $1
      `,
      [studentId]
    );

    return res.status(200).json({
      student_id: studentId,
      item_key: keysToGrant[0] ?? null,
      granted_count: upsertResult.rows.length,
      granted_keys: keysToGrant,
      equipped: equip,
      owned_count: Number(counts.rows[0]?.owned_count ?? 0),
      equipped_count: Number(counts.rows[0]?.equipped_count ?? 0),
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
