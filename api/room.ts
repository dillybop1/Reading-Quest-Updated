import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";

const XP_MILESTONE_STEP = 500;
const ROOM_POSITION_MIN = 2;
const ROOM_POSITION_MAX = 98;
const ROOM_Z_INDEX_MIN = 1;
const ROOM_Z_INDEX_MAX = 999;

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
    key: "small_plant",
    name: "Small Plant",
    description: "A tiny green plant for your desk corner.",
    category: "small_plant",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "cactus",
    name: "Cactus Buddy",
    description: "A fun cactus prop for your reading room.",
    category: "cactus",
    cost_coins: 35,
    min_xp: 50,
  },
  {
    key: "small_blue_picture",
    name: "Blue Picture",
    description: "A framed blue scene for your wall.",
    category: "small_blue_picture",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "small_yellow_picture",
    name: "Yellow Picture",
    description: "A warm framed picture to brighten the room.",
    category: "small_yellow_picture",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "wall_clock",
    name: "Wall Clock",
    description: "Keep track of quest time with a cozy wall clock.",
    category: "wall_clock",
    cost_coins: 55,
    min_xp: 180,
  },
  {
    key: "blue_chair",
    name: "Blue Chair",
    description: "A comfy reading chair for quick breaks.",
    category: "blue_chair",
    cost_coins: 70,
    min_xp: 240,
  },
  {
    key: "side_table",
    name: "Side Table",
    description: "A simple side table for room style.",
    category: "side_table",
    cost_coins: 80,
    min_xp: 300,
  },
  {
    key: "small_table",
    name: "Small Table",
    description: "A small round table for room decor.",
    category: "small_table",
    cost_coins: 90,
    min_xp: 360,
  },
  {
    key: "small_blue_sidetable",
    name: "Blue Side Cabinet",
    description: "A compact cabinet with extra personality.",
    category: "small_blue_sidetable",
    cost_coins: 100,
    min_xp: 430,
  },
  {
    key: "desk_lamp",
    name: "Desk Lamp",
    description: "A reading lamp for late-night quests.",
    category: "desk_lamp",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "hanging_lamp",
    name: "Hanging Lamp",
    description: "A ceiling lamp that adds cozy vibes.",
    category: "hanging_lamp",
    cost_coins: 140,
    min_xp: 620,
  },
  {
    key: "medium_potted_plant",
    name: "Potted Plant",
    description: "A medium plant to make your room feel alive.",
    category: "medium_potted_plant",
    cost_coins: 150,
    min_xp: 720,
  },
  {
    key: "potion_rack",
    name: "Potion Rack",
    description: "A magical shelf full of colorful potions.",
    category: "potion_rack",
    cost_coins: 170,
    min_xp: 820,
  },
  {
    key: "wizard_globe",
    name: "Wizard Globe",
    description: "A glowing globe for your wizard corner.",
    category: "wizard_globe",
    cost_coins: 190,
    min_xp: 920,
  },
  {
    key: "baby_dragon",
    name: "Baby Dragon",
    description: "A tiny dragon companion for your wall.",
    category: "baby_dragon",
    cost_coins: 220,
    min_xp: 1040,
  },
  {
    key: "green_couch",
    name: "Green Couch",
    description: "A comfy couch for long reading quests.",
    category: "green_couch",
    cost_coins: 250,
    min_xp: 1180,
  },
  {
    key: "tree_hammock",
    name: "Tree Hammock",
    description: "A dreamy hammock setup for peak relaxation.",
    category: "tree_hammock",
    cost_coins: 280,
    min_xp: 1320,
  },
  {
    key: "alarm_clock",
    name: "Alarm Clock",
    description: "A bright alarm clock for your room.",
    category: "alarm_clock",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "bean_bag",
    name: "Bean Bag",
    description: "A cozy bean bag for reading breaks.",
    category: "bean_bag",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "blue_bed",
    name: "Blue Bed",
    description: "A cool blue bed setup.",
    category: "blue_bed",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "bookshelf_1",
    name: "Bookshelf One",
    description: "A classic bookshelf packed with stories.",
    category: "bookshelf_1",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "bookshelf_2",
    name: "Bookshelf Two",
    description: "Another bookshelf to expand your library.",
    category: "bookshelf_2",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "circle_mirror",
    name: "Circle Mirror",
    description: "A round mirror for your wall.",
    category: "circle_mirror",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "colorful_end_table",
    name: "Colorful End Table",
    description: "A bright side table with color pop.",
    category: "colorful_end_table",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "desk",
    name: "Desk",
    description: "A sturdy desk for study and quests.",
    category: "desk",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "hamper",
    name: "Hamper",
    description: "A room hamper to keep things tidy.",
    category: "hamper",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "floor_lamp",
    name: "Floor Lamp",
    description: "A standing lamp for warm lighting.",
    category: "floor_lamp",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "multi_pictures",
    name: "Picture Set",
    description: "A set of framed wall pictures.",
    category: "multi_pictures",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "pink_bed",
    name: "Pink Bed",
    description: "A comfy pink bed setup.",
    category: "pink_bed",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "radio",
    name: "Radio",
    description: "A retro radio for background music vibes.",
    category: "radio",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "rectangle_windows",
    name: "Rectangle Windows",
    description: "Wide window set for more sunlight.",
    category: "rectangle_windows",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "rounded_window",
    name: "Rounded Window",
    description: "A rounded window for cozy style.",
    category: "rounded_window",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "slippers",
    name: "Slippers",
    description: "Soft slippers for a comfy room touch.",
    category: "slippers",
    cost_coins: 0,
    min_xp: 0,
  },
  {
    key: "small_plant_2",
    name: "Small Plant Two",
    description: "Another leafy plant for extra greenery.",
    category: "small_plant_2",
    cost_coins: 0,
    min_xp: 0,
  },
];

const catalogByKey = new Map(ROOM_ITEM_CATALOG.map((item) => [item.key, item]));

const getStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseRoomPosition = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, ROOM_POSITION_MIN, ROOM_POSITION_MAX);
};
const parseRoomZIndex = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX);
};

type StarterRoomItemLayout = {
  key: string;
  pos_x: number;
  pos_y: number;
  z_index: number;
};

const STARTER_ROOM_LAYOUT: StarterRoomItemLayout[] = [
  { key: "bookshelf_2", pos_x: 12, pos_y: 67, z_index: 16 },
  { key: "small_plant", pos_x: 8, pos_y: 41, z_index: 29 },
  { key: "desk", pos_x: 27, pos_y: 76, z_index: 16 },
  { key: "desk_lamp", pos_x: 24, pos_y: 66, z_index: 30 },
  { key: "small_blue_picture", pos_x: 75, pos_y: 31, z_index: 21 },
  { key: "small_yellow_picture", pos_x: 90, pos_y: 37, z_index: 21 },
  { key: "rectangle_windows", pos_x: 83, pos_y: 47, z_index: 20 },
  { key: "colorful_end_table", pos_x: 74, pos_y: 75, z_index: 18 },
  { key: "radio", pos_x: 72, pos_y: 66, z_index: 28 },
  { key: "small_plant_2", pos_x: 78, pos_y: 66, z_index: 28 },
  { key: "blue_bed", pos_x: 84, pos_y: 79, z_index: 15 },
  { key: "slippers", pos_x: 86, pos_y: 91, z_index: 27 },
  { key: "floor_lamp", pos_x: 93, pos_y: 71, z_index: 19 },
  { key: "hamper", pos_x: 98, pos_y: 78, z_index: 17 },
];

const STARTER_ROOM_ITEM_KEYS = STARTER_ROOM_LAYOUT.map((entry) => entry.key);

const ensureStarterRoomItems = async (studentId: number) => {
  const [ownedResult, ownedStarterResult] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM student_room_items WHERE student_id = $1", [studentId]),
    query(
      `
        SELECT item_key
        FROM student_room_items
        WHERE student_id = $1
          AND item_key = ANY($2::text[])
      `,
      [studentId, STARTER_ROOM_ITEM_KEYS]
    ),
  ]);

  const ownedCount = Number(ownedResult.rows[0]?.count ?? 0);
  const ownedStarterKeys = new Set<string>(
    ownedStarterResult.rows
      .map((row) => (typeof row.item_key === "string" ? row.item_key : ""))
      .filter(Boolean)
  );

  if (ownedStarterKeys.size === STARTER_ROOM_ITEM_KEYS.length) return;

  if (ownedCount === 0) {
    for (const starter of STARTER_ROOM_LAYOUT) {
      await query(
        `
          INSERT INTO student_room_items (student_id, item_key, is_equipped, pos_x, pos_y, z_index)
          VALUES ($1, $2, true, $3, $4, $5)
          ON CONFLICT (student_id, item_key) DO NOTHING
        `,
        [studentId, starter.key, starter.pos_x, starter.pos_y, starter.z_index]
      );
    }
    return;
  }

  const missingStarterKeys = STARTER_ROOM_ITEM_KEYS.filter((key) => !ownedStarterKeys.has(key));
  await Promise.all(
    missingStarterKeys.map((itemKey) =>
      query(
        `
          INSERT INTO student_room_items (student_id, item_key, is_equipped)
          VALUES ($1, $2, false)
          ON CONFLICT (student_id, item_key) DO NOTHING
        `,
        [studentId, itemKey]
      )
    )
  );
};

const buildRoomState = async (studentId: number) => {
  await ensureStarterRoomItems(studentId);

  const [statsResult, ownedResult] = await Promise.all([
    query("SELECT total_xp, coins FROM user_stats WHERE student_id = $1 ORDER BY id ASC LIMIT 1", [studentId]),
    query(
      `
        SELECT
          item_key,
          COALESCE(is_equipped, false) AS is_equipped,
          pos_x,
          pos_y,
          z_index
        FROM student_room_items
        WHERE student_id = $1
      `,
      [studentId]
    ),
  ]);

  const totalXp = Number(statsResult.rows[0]?.total_xp ?? 0);
  const coins = Number(statsResult.rows[0]?.coins ?? 0);
  const nextMilestoneXp = (Math.floor(totalXp / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP;
  const ownedMap = new Map<
    string,
    {
      equipped: boolean;
      pos_x: number | null;
      pos_y: number | null;
      z_index: number | null;
    }
  >();

  for (const row of ownedResult.rows) {
    if (typeof row.item_key === "string") {
      const parsedPosX = row.pos_x == null ? null : Number(row.pos_x);
      const parsedPosY = row.pos_y == null ? null : Number(row.pos_y);
      const parsedZIndex = row.z_index == null ? null : Number.parseInt(String(row.z_index), 10);
      ownedMap.set(row.item_key, {
        equipped: Boolean(row.is_equipped),
        pos_x: Number.isFinite(parsedPosX) ? clamp(parsedPosX, ROOM_POSITION_MIN, ROOM_POSITION_MAX) : null,
        pos_y: Number.isFinite(parsedPosY) ? clamp(parsedPosY, ROOM_POSITION_MIN, ROOM_POSITION_MAX) : null,
        z_index: Number.isFinite(parsedZIndex) ? clamp(parsedZIndex, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX) : null,
      });
    }
  }

  const items = ROOM_ITEM_CATALOG.map((item) => {
    const ownedState = ownedMap.get(item.key);
    const owned = Boolean(ownedState);
    const equipped = ownedState?.equipped ?? false;
    const unlocked = totalXp >= item.min_xp;
    return {
      ...item,
      owned,
      equipped,
      unlocked,
      pos_x: ownedState?.pos_x ?? null,
      pos_y: ownedState?.pos_y ?? null,
      z_index: ownedState?.z_index ?? null,
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
    if (action === "reset_layout_all") {
      await query("UPDATE student_room_items SET pos_x = NULL, pos_y = NULL, z_index = NULL WHERE student_id = $1", [
        student.studentId,
      ]);
      const roomState = await buildRoomState(student.studentId);
      return res.status(200).json(roomState);
    }

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
    } else if (action === "update_layout") {
      if (!alreadyOwned) {
        return res.status(400).json({ error: "Purchase this item first" });
      }

      const posX = parseRoomPosition(req.body?.pos_x);
      const posY = parseRoomPosition(req.body?.pos_y);
      const zIndex = parseRoomZIndex(req.body?.z_index);

      if (posX == null || posY == null || zIndex == null) {
        return res.status(400).json({ error: "Invalid layout values" });
      }

      await query(
        `
          UPDATE student_room_items
          SET pos_x = $1, pos_y = $2, z_index = $3
          WHERE student_id = $4 AND item_key = $5
        `,
        [posX, posY, zIndex, student.studentId, item.key]
      );
    } else if (action === "reset_layout") {
      if (!alreadyOwned) {
        return res.status(400).json({ error: "Purchase this item first" });
      }
      await query(
        `
          UPDATE student_room_items
          SET pos_x = NULL, pos_y = NULL, z_index = NULL
          WHERE student_id = $1 AND item_key = $2
        `,
        [student.studentId, item.key]
      );
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
