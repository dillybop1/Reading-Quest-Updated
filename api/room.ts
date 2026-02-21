import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_MILESTONE_STEP = 500;

type RoomItemDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  cost_coins: number;
  min_xp: number;
};

const ROOM_ITEM_CATALOG: RoomItemDefinition[] = [
  {
    key: "cozy_rug",
    name: "Cozy Rug",
    description: "A warm rug to make the room feel homey.",
    category: "floor",
    cost_coins: 25,
    min_xp: 0,
  },
  {
    key: "wall_poster",
    name: "Story Poster",
    description: "A bright poster for your reading wall.",
    category: "wall",
    cost_coins: 45,
    min_xp: 120,
  },
  {
    key: "desk_plant",
    name: "Desk Plant",
    description: "A small green plant near the computer.",
    category: "desk",
    cost_coins: 60,
    min_xp: 220,
  },
  {
    key: "window_curtains",
    name: "Curtains",
    description: "Soft curtains for the bedroom window.",
    category: "window",
    cost_coins: 85,
    min_xp: 320,
  },
  {
    key: "bed_blanket",
    name: "Comfy Blanket",
    description: "A colorful blanket upgrade for your bed.",
    category: "bed",
    cost_coins: 95,
    min_xp: 420,
  },
  {
    key: "desk_lamp",
    name: "Desk Lamp",
    description: "A reading lamp for late-night quests.",
    category: "desk",
    cost_coins: 120,
    min_xp: 520,
  },
  {
    key: "string_lights",
    name: "String Lights",
    description: "Twinkle lights around the room.",
    category: "wall",
    cost_coins: 150,
    min_xp: 700,
  },
  {
    key: "book_trophy",
    name: "Book Trophy",
    description: "A trophy that celebrates your reading wins.",
    category: "shelf",
    cost_coins: 220,
    min_xp: 900,
  },
];

const catalogByKey = new Map(ROOM_ITEM_CATALOG.map((item) => [item.key, item]));

const getStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const buildRoomState = async (studentId: number) => {
  const [statsResult, ownedResult] = await Promise.all([
    query("SELECT total_xp, coins FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1", [studentId]),
    query("SELECT item_key, COALESCE(is_equipped, false) AS is_equipped FROM student_room_items WHERE student_id = $1", [
      studentId,
    ]),
  ]);

  const totalXp = Number(statsResult.rows[0]?.total_xp ?? 0);
  const coins = Number(statsResult.rows[0]?.coins ?? 0);
  const nextMilestoneXp = (Math.floor(totalXp / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP;
  const ownedMap = new Map<string, boolean>();

  for (const row of ownedResult.rows) {
    if (typeof row.item_key === "string") {
      ownedMap.set(row.item_key, Boolean(row.is_equipped));
    }
  }

  const items = ROOM_ITEM_CATALOG.map((item) => {
    const owned = ownedMap.has(item.key);
    const equipped = ownedMap.get(item.key) ?? false;
    const unlocked = totalXp >= item.min_xp;
    return {
      ...item,
      owned,
      equipped,
      unlocked,
    };
  });

  return {
    total_xp: totalXp,
    coins,
    next_milestone_xp: nextMilestoneXp,
    items,
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    if (req.method === "GET") {
      const roomState = await buildRoomState(student.studentId);
      return res.status(200).json(roomState);
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = getStringValue(req.body?.action).toLowerCase();
    const itemKey = getStringValue(req.body?.item_key);
    const item = catalogByKey.get(itemKey);

    if (!item) {
      return res.status(400).json({ error: "Invalid item_key" });
    }

    const roomStateBefore = await buildRoomState(student.studentId);
    const alreadyOwned = roomStateBefore.items.find((row) => row.key === item.key)?.owned ?? false;

    if (action === "purchase") {
      if (alreadyOwned) {
        return res.status(400).json({ error: "Item already owned" });
      }

      if (roomStateBefore.total_xp < item.min_xp) {
        return res.status(400).json({ error: "Not enough XP to unlock this item" });
      }

      if (roomStateBefore.coins < item.cost_coins) {
        return res.status(400).json({ error: "Not enough coins" });
      }

      const coinsUpdated = await query(
        `
          UPDATE user_stats
          SET coins = COALESCE(coins, 0) - $1
          WHERE student_id = $2 AND COALESCE(coins, 0) >= $1
        `,
        [item.cost_coins, student.studentId]
      );
      if (!coinsUpdated.rowCount) {
        return res.status(400).json({ error: "Not enough coins" });
      }

      await query(
        `
          INSERT INTO student_room_items (student_id, item_key, is_equipped)
          VALUES ($1, $2, true)
          ON CONFLICT (student_id, item_key)
          DO UPDATE SET is_equipped = true
        `,
        [student.studentId, item.key]
      );

      if (item.category) {
        const categoryKeys = ROOM_ITEM_CATALOG.filter((row) => row.category === item.category).map((row) => row.key);
        if (categoryKeys.length > 0) {
          await query(
            `
              UPDATE student_room_items
              SET is_equipped = false
              WHERE student_id = $1
                AND item_key = ANY($2::text[])
                AND item_key <> $3
            `,
            [student.studentId, categoryKeys, item.key]
          );
        }
      }
    } else if (action === "equip") {
      if (!alreadyOwned) {
        return res.status(400).json({ error: "Purchase this item first" });
      }

      const categoryKeys = ROOM_ITEM_CATALOG.filter((row) => row.category === item.category).map((row) => row.key);
      if (categoryKeys.length > 0) {
        await query(
          `
            UPDATE student_room_items
            SET is_equipped = false
            WHERE student_id = $1
              AND item_key = ANY($2::text[])
          `,
          [student.studentId, categoryKeys]
        );
      }

      await query("UPDATE student_room_items SET is_equipped = true WHERE student_id = $1 AND item_key = $2", [
        student.studentId,
        item.key,
      ]);
    } else if (action === "unequip") {
      await query("UPDATE student_room_items SET is_equipped = false WHERE student_id = $1 AND item_key = $2", [
        student.studentId,
        item.key,
      ]);
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const roomState = await buildRoomState(student.studentId);
    return res.status(200).json(roomState);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
