import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("reading_quest.db");

// Initialize database
// Note: these CREATE TABLE statements apply to new databases. Existing databases
// are migrated below with ALTER TABLE statements.
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_code TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_code, nickname)
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    total_pages INTEGER NOT NULL,
    current_page INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 0,
    student_id INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    student_id INTEGER,
    start_page INTEGER,
    end_page INTEGER,
    chapters_finished INTEGER,
    duration_minutes INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    xp_earned INTEGER,
    FOREIGN KEY(book_id) REFERENCES books(id),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    coins INTEGER DEFAULT 0,
    total_coins_earned INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 1,
    last_active_date TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS session_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    student_id INTEGER,
    book_id INTEGER,
    question_index INTEGER,
    question_text TEXT,
    answer_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS achievement_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    achievement_key TEXT NOT NULL,
    period_key TEXT NOT NULL DEFAULT 'lifetime',
    awarded_xp INTEGER DEFAULT 0,
    awarded_coins INTEGER DEFAULT 0,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, achievement_key, period_key),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS student_book_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    book_id INTEGER,
    completion_number INTEGER NOT NULL,
    sticker_key TEXT,
    rating_key TEXT,
    sticker_pos_x REAL,
    sticker_pos_y REAL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, book_id),
    UNIQUE(student_id, completion_number),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS student_room_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    item_key TEXT NOT NULL,
    is_equipped INTEGER DEFAULT 0,
    pos_x REAL,
    pos_y REAL,
    z_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, item_key),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
`);

const hasColumn = (table: string, column: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((item) => item.name === column);
};

const ensureColumn = (table: string, column: string, typeSql: string) => {
  if (!hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`).run();
  }
};

ensureColumn("books", "student_id", "INTEGER");
ensureColumn("sessions", "student_id", "INTEGER");
ensureColumn("user_stats", "student_id", "INTEGER");
ensureColumn("books", "current_page", "INTEGER DEFAULT 0");
ensureColumn("books", "is_active", "INTEGER DEFAULT 0");
ensureColumn("sessions", "timestamp", "DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("sessions", "xp_earned", "INTEGER");
ensureColumn("user_stats", "total_xp", "INTEGER DEFAULT 0");
ensureColumn("user_stats", "level", "INTEGER DEFAULT 1");
ensureColumn("user_stats", "coins", "INTEGER DEFAULT 0");
ensureColumn("user_stats", "total_coins_earned", "INTEGER DEFAULT 0");
ensureColumn("user_stats", "streak_days", "INTEGER DEFAULT 1");
ensureColumn("user_stats", "last_active_date", "TEXT");
ensureColumn("session_reflections", "session_id", "INTEGER");
ensureColumn("session_reflections", "student_id", "INTEGER");
ensureColumn("session_reflections", "book_id", "INTEGER");
ensureColumn("session_reflections", "question_index", "INTEGER");
ensureColumn("session_reflections", "question_text", "TEXT");
ensureColumn("session_reflections", "answer_text", "TEXT");
ensureColumn("session_reflections", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("achievement_unlocks", "student_id", "INTEGER");
ensureColumn("achievement_unlocks", "achievement_key", "TEXT");
ensureColumn("achievement_unlocks", "period_key", "TEXT DEFAULT 'lifetime'");
ensureColumn("achievement_unlocks", "awarded_xp", "INTEGER DEFAULT 0");
ensureColumn("achievement_unlocks", "awarded_coins", "INTEGER DEFAULT 0");
ensureColumn("achievement_unlocks", "unlocked_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("student_book_completions", "student_id", "INTEGER");
ensureColumn("student_book_completions", "book_id", "INTEGER");
ensureColumn("student_book_completions", "completion_number", "INTEGER");
ensureColumn("student_book_completions", "sticker_key", "TEXT");
ensureColumn("student_book_completions", "rating_key", "TEXT");
ensureColumn("student_book_completions", "sticker_pos_x", "REAL");
ensureColumn("student_book_completions", "sticker_pos_y", "REAL");
ensureColumn("student_book_completions", "completed_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("student_room_items", "student_id", "INTEGER");
ensureColumn("student_room_items", "item_key", "TEXT");
ensureColumn("student_room_items", "is_equipped", "INTEGER DEFAULT 0");
ensureColumn("student_room_items", "pos_x", "REAL");
ensureColumn("student_room_items", "pos_y", "REAL");
ensureColumn("student_room_items", "z_index", "INTEGER");
ensureColumn("student_room_items", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_nickname ON students(class_code, nickname);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stats_student_id ON user_stats(student_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_achievement_unlocks_student_key_period
  ON achievement_unlocks(student_id, achievement_key, period_key);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_student_book_completions_student_book
  ON student_book_completions(student_id, book_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_student_book_completions_student_completion
  ON student_book_completions(student_id, completion_number);
  CREATE INDEX IF NOT EXISTS idx_books_student_id ON books(student_id);
  CREATE INDEX IF NOT EXISTS idx_books_student_active ON books(student_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
  CREATE INDEX IF NOT EXISTS idx_reflections_student_id ON session_reflections(student_id);
  CREATE INDEX IF NOT EXISTS idx_reflections_session_id ON session_reflections(session_id);
  CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_student_unlocked_at
  ON achievement_unlocks(student_id, unlocked_at DESC);
  CREATE INDEX IF NOT EXISTS idx_student_book_completions_student_completed_at
  ON student_book_completions(student_id, completed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_room_items_student_id ON student_room_items(student_id);
`);

const XP_PER_LEVEL = 500;
const XP_MILESTONE_STEP = 500;
const COIN_DIVISOR = 10;
const MILESTONE_BONUS_COINS = 75;
const ROOM_POSITION_MIN = 2;
const ROOM_POSITION_MAX = 98;
const ROOM_Z_INDEX_MIN = 1;
const ROOM_Z_INDEX_MAX = 999;
const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const NICKNAME_REGEX = /^[A-Za-z0-9 _.-]{2,24}$/;
const ADMIN_ACCESS_CODE = (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_KEY || "Umphress1997!").trim();
const BOOK_COMPLETION_STICKER_KEYS = new Set([
  "dragon",
  "rocket",
  "crown",
  "owl",
  "lightning",
  "mountain",
  "bookworm",
  "shield",
]);
const BOOK_COMPLETION_RATING_KEYS = new Set(["loved_it", "good_read", "hard_for_me"]);

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
    cost_coins: 20,
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
    cost_coins: 45,
    min_xp: 100,
  },
  {
    key: "small_yellow_picture",
    name: "Yellow Picture",
    description: "A warm framed picture to brighten the room.",
    category: "small_yellow_picture",
    cost_coins: 45,
    min_xp: 140,
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
    cost_coins: 120,
    min_xp: 520,
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

const roomCatalogByKey = new Map(ROOM_ITEM_CATALOG.map((item) => [item.key, item]));

type StudentIdentity = {
  classCode: string;
  nickname: string;
  studentId: number;
};

type SessionPayload = {
  book_id: number;
  start_page: number;
  end_page: number;
  chapters_finished: number;
  duration_minutes: number;
  goal_minutes?: number;
  xp_earned: number;
  questions?: string[];
  answers?: string[];
};

type AchievementMetric =
  | "total_sessions"
  | "total_pages"
  | "total_minutes"
  | "streak_days"
  | "reflection_sessions"
  | "weekly_sessions"
  | "weekly_pages"
  | "weekly_minutes";

type ThresholdAchievementDefinition = {
  key: string;
  title: string;
  description: string;
  target: number;
  reward_xp: number;
  reward_coins: number;
  metric: AchievementMetric;
  is_repeatable: boolean;
  period_mode: "lifetime" | "weekly" | "session_block_10_after_30";
};

type BookMilestoneAchievementDefinition = {
  key: string;
  title: string;
  description: string;
  target: number;
  reward_xp: number;
  reward_coins: number;
  is_repeatable: false;
  period_mode: "lifetime";
};

type BookRepeatAchievementDefinition = {
  key: "book_complete_repeat";
  title: string;
  description: string;
  reward_xp: number;
  reward_coins: number;
  is_repeatable: true;
  period_mode: "per_completion";
};

type AchievementSnapshot = {
  total_sessions: number;
  total_pages: number;
  total_minutes: number;
  streak_days: number;
  reflection_sessions: number;
  weekly_sessions: number;
  weekly_pages: number;
  weekly_minutes: number;
  completed_books_count: number;
};

type AchievementUnlock = {
  key: string;
  title: string;
  description: string;
  reward_xp: number;
  reward_coins: number;
  period_key: string;
  unlocked_at: string;
  is_repeatable: boolean;
};

type AchievementChecklistItem = {
  key: string;
  title: string;
  description: string;
  reward_xp: number;
  reward_coins: number;
  target: number | null;
  progress: number;
  is_unlocked: boolean;
  is_repeatable: boolean;
  times_earned: number;
  current_period_key: string | null;
};

const BOOK_COMPLETION_REWARDS = [
  { reward_xp: 150, reward_coins: 120 },
  { reward_xp: 225, reward_coins: 180 },
  { reward_xp: 300, reward_coins: 240 },
  { reward_xp: 375, reward_coins: 300 },
  { reward_xp: 450, reward_coins: 360 },
];

const BOOK_MILESTONE_ACHIEVEMENTS: BookMilestoneAchievementDefinition[] = [
  {
    key: "book_complete_1",
    title: "First Book Complete",
    description: "Finish your first full book.",
    target: 1,
    reward_xp: BOOK_COMPLETION_REWARDS[0].reward_xp,
    reward_coins: BOOK_COMPLETION_REWARDS[0].reward_coins,
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "book_complete_2",
    title: "Second Book Complete",
    description: "Finish two books in total.",
    target: 2,
    reward_xp: BOOK_COMPLETION_REWARDS[1].reward_xp,
    reward_coins: BOOK_COMPLETION_REWARDS[1].reward_coins,
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "book_complete_3",
    title: "Third Book Complete",
    description: "Finish three books in total.",
    target: 3,
    reward_xp: BOOK_COMPLETION_REWARDS[2].reward_xp,
    reward_coins: BOOK_COMPLETION_REWARDS[2].reward_coins,
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "book_complete_4",
    title: "Fourth Book Complete",
    description: "Finish four books in total.",
    target: 4,
    reward_xp: BOOK_COMPLETION_REWARDS[3].reward_xp,
    reward_coins: BOOK_COMPLETION_REWARDS[3].reward_coins,
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "book_complete_5",
    title: "Fifth Book Complete",
    description: "Finish five books in total.",
    target: 5,
    reward_xp: BOOK_COMPLETION_REWARDS[4].reward_xp,
    reward_coins: BOOK_COMPLETION_REWARDS[4].reward_coins,
    is_repeatable: false,
    period_mode: "lifetime",
  },
];

const BOOK_REPEAT_ACHIEVEMENT: BookRepeatAchievementDefinition = {
  key: "book_complete_repeat",
  title: "Book Champion",
  description: "After book five, every additional completed book repeats this reward.",
  reward_xp: BOOK_COMPLETION_REWARDS[4].reward_xp,
  reward_coins: BOOK_COMPLETION_REWARDS[4].reward_coins,
  is_repeatable: true,
  period_mode: "per_completion",
};

const THRESHOLD_ACHIEVEMENTS: ThresholdAchievementDefinition[] = [
  {
    key: "first_session",
    title: "First Quest",
    description: "Complete your first reading session.",
    target: 1,
    reward_xp: 20,
    reward_coins: 15,
    metric: "total_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "session_5",
    title: "Quest Runner",
    description: "Complete 5 reading sessions.",
    target: 5,
    reward_xp: 40,
    reward_coins: 25,
    metric: "total_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "session_10",
    title: "Quest Veteran",
    description: "Complete 10 reading sessions.",
    target: 10,
    reward_xp: 75,
    reward_coins: 50,
    metric: "total_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "session_30",
    title: "Quest Champion",
    description: "Complete 30 reading sessions.",
    target: 30,
    reward_xp: 180,
    reward_coins: 130,
    metric: "total_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "session_repeat_10",
    title: "Champion Encore",
    description: "After 30 sessions, every 10 more sessions grants this reward.",
    target: 10,
    reward_xp: 90,
    reward_coins: 70,
    metric: "total_sessions",
    is_repeatable: true,
    period_mode: "session_block_10_after_30",
  },
  {
    key: "pages_100",
    title: "Page Turner",
    description: "Read 100 total pages.",
    target: 100,
    reward_xp: 60,
    reward_coins: 40,
    metric: "total_pages",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "pages_500",
    title: "Page Explorer",
    description: "Read 500 total pages.",
    target: 500,
    reward_xp: 120,
    reward_coins: 90,
    metric: "total_pages",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "pages_1000",
    title: "Page Master",
    description: "Read 1000 total pages.",
    target: 1000,
    reward_xp: 180,
    reward_coins: 140,
    metric: "total_pages",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "streak_3",
    title: "Streak Starter",
    description: "Reach a 3-day reading streak.",
    target: 3,
    reward_xp: 50,
    reward_coins: 35,
    metric: "streak_days",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "streak_7",
    title: "Streak Hero",
    description: "Reach a 7-day reading streak.",
    target: 7,
    reward_xp: 100,
    reward_coins: 75,
    metric: "streak_days",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "minutes_120",
    title: "Time Starter",
    description: "Read for 120 total minutes.",
    target: 120,
    reward_xp: 45,
    reward_coins: 30,
    metric: "total_minutes",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "minutes_300",
    title: "Time Keeper",
    description: "Read for 300 total minutes.",
    target: 300,
    reward_xp: 80,
    reward_coins: 55,
    metric: "total_minutes",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "minutes_900",
    title: "Time Master",
    description: "Read for 900 total minutes.",
    target: 900,
    reward_xp: 170,
    reward_coins: 120,
    metric: "total_minutes",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "reflection_10",
    title: "Thoughtful Reader",
    description: "Submit reflections for 10 sessions.",
    target: 10,
    reward_xp: 90,
    reward_coins: 60,
    metric: "reflection_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "reflection_50",
    title: "Reflection Sage",
    description: "Submit reflections for 50 sessions.",
    target: 50,
    reward_xp: 220,
    reward_coins: 160,
    metric: "reflection_sessions",
    is_repeatable: false,
    period_mode: "lifetime",
  },
  {
    key: "weekly_sessions_4",
    title: "Weekly Quest x4",
    description: "Complete 4 reading sessions this week.",
    target: 4,
    reward_xp: 50,
    reward_coins: 35,
    metric: "weekly_sessions",
    is_repeatable: true,
    period_mode: "weekly",
  },
  {
    key: "weekly_pages_90",
    title: "Weekly 90 Pages",
    description: "Read 90 pages this week.",
    target: 90,
    reward_xp: 60,
    reward_coins: 45,
    metric: "weekly_pages",
    is_repeatable: true,
    period_mode: "weekly",
  },
  {
    key: "weekly_minutes_180",
    title: "Weekly 180 Minutes",
    description: "Read 180 minutes this week.",
    target: 180,
    reward_xp: 60,
    reward_coins: 45,
    metric: "weekly_minutes",
    is_repeatable: true,
    period_mode: "weekly",
  },
];

const CHECKLIST_ORDER = [...BOOK_MILESTONE_ACHIEVEMENTS, BOOK_REPEAT_ACHIEVEMENT, ...THRESHOLD_ACHIEVEMENTS];

const getStringValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

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

const normalizeClassCode = (value: unknown) => getStringValue(value).trim().toUpperCase();
const normalizeNickname = (value: unknown) => getStringValue(value).trim();

const getRequestField = (req: express.Request, key: string) => {
  const queryValue = getStringValue(req.query?.[key]);
  if (queryValue) return queryValue;
  return getStringValue((req.body ?? {})[key]);
};

const parseNicknames = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
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

const MAX_REFLECTION_LENGTH = 4000;
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

const STREAK_XP_BONUS_PER_DAY = 0.05;
const STREAK_XP_BONUS_MAX = 0.5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
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

const touchStudentStreak = (studentId: number) => {
  const today = getTodayDateString();
  const current =
    (db
      .prepare("SELECT streak_days, last_active_date FROM user_stats WHERE student_id = ? LIMIT 1")
      .get(studentId) as { streak_days?: number; last_active_date?: string | null } | undefined) ?? {};
  const next = computeNextStreak(Number(current.streak_days ?? 1), current.last_active_date, today);
  if (next.changed) {
    db.prepare("UPDATE user_stats SET streak_days = ?, last_active_date = ? WHERE student_id = ?").run(
      next.streakDays,
      next.lastActiveDate,
      studentId
    );
  }

  return next.streakDays;
};

const toSafeInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const getWeekPeriodKey = (date = new Date()) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);

  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / ONE_WEEK_MS);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
};

const buildUnlockPayload = (
  definition: {
    key: string;
    title: string;
    description: string;
    reward_xp: number;
    reward_coins: number;
    is_repeatable: boolean;
  },
  periodKey: string,
  unlockedAt: string,
  rewardXp?: number,
  rewardCoins?: number
): AchievementUnlock => ({
  key: definition.key,
  title: definition.title,
  description: definition.description,
  reward_xp: Number.isFinite(rewardXp) ? Math.max(0, Math.floor(Number(rewardXp))) : definition.reward_xp,
  reward_coins: Number.isFinite(rewardCoins) ? Math.max(0, Math.floor(Number(rewardCoins))) : definition.reward_coins,
  period_key: periodKey,
  unlocked_at: unlockedAt,
  is_repeatable: definition.is_repeatable,
});

const getBookCompletionReward = (completionNumber: number) => {
  const safeCompletion = Math.max(1, Math.floor(completionNumber || 1));
  const rewardIndex = Math.min(BOOK_COMPLETION_REWARDS.length, safeCompletion) - 1;
  return BOOK_COMPLETION_REWARDS[rewardIndex];
};

const loadAchievementSnapshot = (studentId: number, currentPeriodKey: string): AchievementSnapshot => {
  const sessions = db
    .prepare("SELECT start_page, end_page, duration_minutes, timestamp FROM sessions WHERE student_id = ?")
    .all(studentId) as Array<{
    start_page?: number | null;
    end_page?: number | null;
    duration_minutes?: number | null;
    timestamp?: string | null;
  }>;

  let totalPages = 0;
  let totalMinutes = 0;
  let weeklySessions = 0;
  let weeklyPages = 0;
  let weeklyMinutes = 0;

  for (const session of sessions) {
    const startPage = toSafeInt(session.start_page, 0);
    const endPage = toSafeInt(session.end_page, 0);
    const duration = Math.max(0, toSafeInt(session.duration_minutes, 0));
    const pagesRead = Math.max(0, endPage - startPage);

    totalPages += pagesRead;
    totalMinutes += duration;

    const parsedDate = session.timestamp ? new Date(session.timestamp) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) continue;

    if (getWeekPeriodKey(parsedDate) === currentPeriodKey) {
      weeklySessions += 1;
      weeklyPages += pagesRead;
      weeklyMinutes += duration;
    }
  }

  const streakStats =
    (db
      .prepare("SELECT COALESCE(streak_days, 1) AS streak_days FROM user_stats WHERE student_id = ? LIMIT 1")
      .get(studentId) as { streak_days?: number } | undefined) ?? {};

  const reflectionStats =
    (db
      .prepare("SELECT COUNT(DISTINCT session_id) AS reflection_sessions FROM session_reflections WHERE student_id = ?")
      .get(studentId) as { reflection_sessions?: number } | undefined) ?? {};

  const completionStats =
    (db
      .prepare("SELECT COUNT(*) AS completed_books_count FROM student_book_completions WHERE student_id = ?")
      .get(studentId) as { completed_books_count?: number } | undefined) ?? {};

  return {
    total_sessions: sessions.length,
    total_pages: totalPages,
    total_minutes: totalMinutes,
    streak_days: Math.max(1, toSafeInt(streakStats.streak_days, 1)),
    reflection_sessions: Math.max(0, toSafeInt(reflectionStats.reflection_sessions, 0)),
    weekly_sessions: weeklySessions,
    weekly_pages: weeklyPages,
    weekly_minutes: weeklyMinutes,
    completed_books_count: Math.max(0, toSafeInt(completionStats.completed_books_count, 0)),
  };
};

const getMetricValue = (snapshot: AchievementSnapshot, metric: AchievementMetric) => Math.max(0, snapshot[metric] ?? 0);

const awardThresholdAchievements = (studentId: number) => {
  const currentPeriodKey = getWeekPeriodKey();
  const snapshot = loadAchievementSnapshot(studentId, currentPeriodKey);
  const unlocks: AchievementUnlock[] = [];

  for (const definition of THRESHOLD_ACHIEVEMENTS) {
    const metricValue = getMetricValue(snapshot, definition.metric);
    if (definition.period_mode === "session_block_10_after_30") {
      const sessionsBeyondThirty = Math.max(0, metricValue - 30);
      const completedBlocks = Math.floor(sessionsBeyondThirty / Math.max(1, definition.target));
      for (let block = 1; block <= completedBlocks; block += 1) {
        const periodKey = `session_block_${block}`;
        const unlockedAt = new Date().toISOString();
        const inserted = db
          .prepare(
            `
              INSERT OR IGNORE INTO achievement_unlocks
              (student_id, achievement_key, period_key, awarded_xp, awarded_coins, unlocked_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `
          )
          .run(studentId, definition.key, periodKey, definition.reward_xp, definition.reward_coins, unlockedAt);

        if (!inserted.changes) continue;
        unlocks.push(buildUnlockPayload(definition, periodKey, unlockedAt));
      }
      continue;
    }

    if (metricValue < definition.target) continue;

    const periodKey = definition.period_mode === "weekly" ? currentPeriodKey : "lifetime";
    const unlockedAt = new Date().toISOString();
    const inserted = db
      .prepare(
        `
          INSERT OR IGNORE INTO achievement_unlocks
          (student_id, achievement_key, period_key, awarded_xp, awarded_coins, unlocked_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(studentId, definition.key, periodKey, definition.reward_xp, definition.reward_coins, unlockedAt);

    if (!inserted.changes) continue;
    unlocks.push(buildUnlockPayload(definition, periodKey, unlockedAt));
  }

  return unlocks;
};

const awardBookCompletionAchievement = (studentId: number, completionNumber: number) => {
  const safeCompletion = Math.max(1, Math.floor(completionNumber || 1));
  const reward = getBookCompletionReward(safeCompletion);
  const definition =
    safeCompletion <= BOOK_MILESTONE_ACHIEVEMENTS.length
      ? BOOK_MILESTONE_ACHIEVEMENTS[safeCompletion - 1]
      : BOOK_REPEAT_ACHIEVEMENT;
  const periodKey = safeCompletion <= BOOK_MILESTONE_ACHIEVEMENTS.length ? "lifetime" : `completion_${safeCompletion}`;
  const unlockedAt = new Date().toISOString();
  const inserted = db
    .prepare(
      `
        INSERT OR IGNORE INTO achievement_unlocks
        (student_id, achievement_key, period_key, awarded_xp, awarded_coins, unlocked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(studentId, definition.key, periodKey, reward.reward_xp, reward.reward_coins, unlockedAt);

  if (!inserted.changes) return null;
  return buildUnlockPayload(definition, periodKey, unlockedAt, reward.reward_xp, reward.reward_coins);
};

const tryRecordBookCompletion = (studentId: number, bookId: number) => {
  const nextCompletion =
    (db
      .prepare("SELECT COALESCE(MAX(completion_number), 0) + 1 AS completion_number FROM student_book_completions WHERE student_id = ?")
      .get(studentId) as { completion_number?: number } | undefined) ?? {};
  const completionNumber = Math.max(1, toSafeInt(nextCompletion.completion_number, 1));
  const completedAt = new Date().toISOString();
  const inserted = db
    .prepare(
      `
        INSERT OR IGNORE INTO student_book_completions
        (student_id, book_id, completion_number, completed_at)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(studentId, bookId, completionNumber, completedAt);

  if (!inserted.changes) return null;
  return { completion_number: completionNumber, completed_at: completedAt };
};

const buildAchievementsResponse = (studentId: number) => {
  const currentPeriodKey = getWeekPeriodKey();
  const snapshot = loadAchievementSnapshot(studentId, currentPeriodKey);
  const unlockRows = db
    .prepare(
      `
        SELECT achievement_key, period_key, unlocked_at, awarded_xp, awarded_coins
        FROM achievement_unlocks
        WHERE student_id = ?
        ORDER BY unlocked_at DESC
      `
    )
    .all(studentId) as Array<{
    achievement_key: string;
    period_key: string;
    unlocked_at: string;
    awarded_xp: number;
    awarded_coins: number;
  }>;

  const timesEarnedByKey = new Map<string, number>();
  const unlockSet = new Set<string>();
  for (const unlock of unlockRows) {
    const key = String(unlock.achievement_key ?? "");
    const periodKey = String(unlock.period_key ?? "");
    if (!key) continue;
    timesEarnedByKey.set(key, (timesEarnedByKey.get(key) ?? 0) + 1);
    unlockSet.add(`${key}::${periodKey}`);
  }

  const definitionByKey = new Map(CHECKLIST_ORDER.map((definition) => [definition.key, definition] as const));

  const achievements: AchievementChecklistItem[] = CHECKLIST_ORDER.map((definition) => {
    if ("metric" in definition) {
      const metricValue = getMetricValue(snapshot, definition.metric);
      if (definition.period_mode === "session_block_10_after_30") {
        const sessionsBeyondThirty = Math.max(0, metricValue - 30);
        const progress = Math.max(0, sessionsBeyondThirty % Math.max(1, definition.target));
        const nextBlock = Math.floor(sessionsBeyondThirty / Math.max(1, definition.target)) + 1;
        return {
          key: definition.key,
          title: definition.title,
          description: definition.description,
          reward_xp: definition.reward_xp,
          reward_coins: definition.reward_coins,
          target: definition.target,
          progress,
          is_unlocked: (timesEarnedByKey.get(definition.key) ?? 0) > 0,
          is_repeatable: definition.is_repeatable,
          times_earned: timesEarnedByKey.get(definition.key) ?? 0,
          current_period_key: `session_block_${nextBlock}`,
        };
      }

      const progress = Math.max(0, Math.min(metricValue, definition.target));
      const isUnlocked =
        definition.period_mode === "weekly"
          ? unlockSet.has(`${definition.key}::${currentPeriodKey}`)
          : (timesEarnedByKey.get(definition.key) ?? 0) > 0;
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        reward_xp: definition.reward_xp,
        reward_coins: definition.reward_coins,
        target: definition.target,
        progress,
        is_unlocked: isUnlocked,
        is_repeatable: definition.is_repeatable,
        times_earned: timesEarnedByKey.get(definition.key) ?? 0,
        current_period_key: definition.period_mode === "weekly" ? currentPeriodKey : null,
      };
    }

    if (definition.key === "book_complete_repeat") {
      const repeatCount = Math.max(0, snapshot.completed_books_count - BOOK_MILESTONE_ACHIEVEMENTS.length);
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        reward_xp: definition.reward_xp,
        reward_coins: definition.reward_coins,
        target: null,
        progress: repeatCount,
        is_unlocked: repeatCount > 0,
        is_repeatable: definition.is_repeatable,
        times_earned: timesEarnedByKey.get(definition.key) ?? 0,
        current_period_key: null,
      };
    }

    if ("target" in definition) {
      const target = definition.target;
      const progress = Math.max(0, Math.min(snapshot.completed_books_count, target));
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        reward_xp: definition.reward_xp,
        reward_coins: definition.reward_coins,
        target,
        progress,
        is_unlocked: (timesEarnedByKey.get(definition.key) ?? 0) > 0,
        is_repeatable: definition.is_repeatable,
        times_earned: timesEarnedByKey.get(definition.key) ?? 0,
        current_period_key: null,
      };
    }

    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      reward_xp: definition.reward_xp,
      reward_coins: definition.reward_coins,
      target: null,
      progress: 0,
      is_unlocked: (timesEarnedByKey.get(definition.key) ?? 0) > 0,
      is_repeatable: definition.is_repeatable,
      times_earned: timesEarnedByKey.get(definition.key) ?? 0,
      current_period_key: null,
    };
  });

  const recentUnlocks: AchievementUnlock[] = unlockRows.slice(0, 10).map((row) => {
    const key = String(row.achievement_key ?? "");
    const periodKey = String(row.period_key ?? "lifetime");
    const definition = definitionByKey.get(key);
    if (definition) {
      return buildUnlockPayload(definition, periodKey, String(row.unlocked_at ?? new Date().toISOString()), row.awarded_xp, row.awarded_coins);
    }
    return {
      key,
      title: key,
      description: "",
      reward_xp: Math.max(0, toSafeInt(row.awarded_xp, 0)),
      reward_coins: Math.max(0, toSafeInt(row.awarded_coins, 0)),
      period_key: periodKey,
      unlocked_at: String(row.unlocked_at ?? new Date().toISOString()),
      is_repeatable: false,
    };
  });

  return {
    current_period_key: currentPeriodKey,
    completed_books_count: snapshot.completed_books_count,
    unlocked_total: unlockRows.length,
    total_available: CHECKLIST_ORDER.length,
    achievements,
    recent_unlocks: recentUnlocks,
  };
};

const buildRoomState = (studentId: number) => {
  const stats =
    (db
      .prepare("SELECT total_xp, coins FROM user_stats WHERE student_id = ? ORDER BY id ASC LIMIT 1")
      .get(studentId) as { total_xp?: number; coins?: number } | undefined) ?? {};

  const totalXp = Number(stats.total_xp ?? 0);
  const coins = Number(stats.coins ?? 0);
  const nextMilestoneXp = (Math.floor(totalXp / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP;

  const ownedRows = db
    .prepare("SELECT item_key, is_equipped, pos_x, pos_y, z_index FROM student_room_items WHERE student_id = ?")
    .all(studentId) as Array<{
    item_key: string;
    is_equipped: number;
    pos_x: number | null;
    pos_y: number | null;
    z_index: number | null;
  }>;
  const ownedMap = new Map<
    string,
    {
      equipped: boolean;
      pos_x: number | null;
      pos_y: number | null;
      z_index: number | null;
    }
  >();
  for (const row of ownedRows) {
    if (typeof row.item_key === "string") {
      const parsedZIndex = row.z_index == null ? null : Number.parseInt(String(row.z_index), 10);
      const parsedPosX = row.pos_x == null ? null : Number(row.pos_x);
      const parsedPosY = row.pos_y == null ? null : Number(row.pos_y);
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
    return {
      ...item,
      owned,
      equipped,
      unlocked: totalXp >= item.min_xp,
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

const toPositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const requireAdmin = (req: express.Request, res: express.Response) => {
  if (!ADMIN_ACCESS_CODE) {
    res.status(503).json({ error: "Admin access is not configured. Set ADMIN_ACCESS_CODE." });
    return false;
  }

  const provided = getStringValue(req.headers["x-admin-key"]).trim() || getRequestField(req, "admin_key").trim();
  if (!provided || provided !== ADMIN_ACCESS_CODE) {
    res.status(401).json({ error: "Unauthorized admin access" });
    return false;
  }

  return true;
};

const parseStudentIdentity = (req: express.Request, res: express.Response) => {
  const classCode = normalizeClassCode(getRequestField(req, "class_code"));
  const nickname = normalizeNickname(getRequestField(req, "nickname"));

  if (!classCode || !nickname) {
    res.status(400).json({ error: "Missing class_code or nickname" });
    return null;
  }

  if (!CLASS_CODE_REGEX.test(classCode)) {
    res.status(400).json({ error: "Invalid class_code format" });
    return null;
  }

  if (!NICKNAME_REGEX.test(nickname)) {
    res.status(400).json({ error: "Invalid nickname format" });
    return null;
  }

  return { classCode, nickname };
};

const getOrCreateStudentId = (classCode: string, nickname: string) => {
  db.prepare("INSERT OR IGNORE INTO students (class_code, nickname) VALUES (?, ?)").run(classCode, nickname);
  const student = db
    .prepare("SELECT id FROM students WHERE class_code = ? AND nickname = ? LIMIT 1")
    .get(classCode, nickname) as { id?: number } | undefined;

  if (!student?.id) {
    throw new Error("Unable to resolve student identity");
  }

  db
    .prepare("INSERT OR IGNORE INTO user_stats (student_id, total_xp, level, coins, total_coins_earned) VALUES (?, 0, 1, 0, 0)")
    .run(student.id);
  return student.id;
};

const resolveStudent = (req: express.Request, res: express.Response): StudentIdentity | null => {
  const parsed = parseStudentIdentity(req, res);
  if (!parsed) return null;

  const studentId = getOrCreateStudentId(parsed.classCode, parsed.nickname);
  return {
    classCode: parsed.classCode,
    nickname: parsed.nickname,
    studentId,
  };
};

async function startServer() {
  const app = express();
  const configuredPort = Number.parseInt(String(process.env.PORT ?? "3000"), 10);
  const PORT = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const streakDays = touchStudentStreak(student.studentId);

    const stats =
      (db.prepare("SELECT * FROM user_stats WHERE student_id = ? LIMIT 1").get(student.studentId) as
        | { total_xp: number; level: number; coins?: number; total_coins_earned?: number; streak_days?: number }
        | undefined) ?? { total_xp: 0, level: 1, coins: 0, total_coins_earned: 0, streak_days: 1 };

    const totalSessions = db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE student_id = ?")
      .get(student.studentId) as { count: number };
    const totalMinutes = db
      .prepare("SELECT COALESCE(SUM(duration_minutes), 0) as total FROM sessions WHERE student_id = ?")
      .get(student.studentId) as { total: number };
    const totalBooks = db
      .prepare("SELECT COUNT(*) as count FROM student_book_completions WHERE student_id = ?")
      .get(student.studentId) as { count: number };

    res.json({
      ...stats,
      streak_days: Math.max(1, Number(stats.streak_days ?? streakDays ?? 1)),
      total_sessions: totalSessions.count,
      total_hours: Math.round(((totalMinutes.total || 0) / 60) * 10) / 10,
      total_books: totalBooks.count,
      next_milestone_xp: (Math.floor((stats.total_xp || 0) / XP_MILESTONE_STEP) + 1) * XP_MILESTONE_STEP,
    });
  });

  app.get("/api/achievements", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    return res.json(buildAchievementsResponse(student.studentId));
  });

  app.get("/api/books", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const books = db
      .prepare(
        `
          SELECT *
          FROM books
          WHERE student_id = ?
            AND (COALESCE(total_pages, 0) <= 0 OR COALESCE(current_page, 0) < COALESCE(total_pages, 0))
          ORDER BY id DESC
        `
      )
      .all(student.studentId);
    res.json(books);
  });

  app.get("/api/books/completed", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const completedBooks = db
      .prepare(
        `
          SELECT
            b.id as book_id,
            b.title,
            b.author,
            COALESCE(b.total_pages, 0) as total_pages,
            sbc.completion_number,
            sbc.sticker_key,
            sbc.rating_key,
            sbc.sticker_pos_x,
            sbc.sticker_pos_y,
            sbc.completed_at
          FROM student_book_completions sbc
          JOIN books b ON b.id = sbc.book_id
          WHERE sbc.student_id = ?
          ORDER BY sbc.completion_number DESC, sbc.completed_at DESC
        `
      )
      .all(student.studentId);

    return res.json(completedBooks);
  });

  app.patch("/api/books/completed", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const completionNumber = toPositiveInt(req.body?.completion_number);
    if (!completionNumber) {
      return res.status(400).json({ error: "Invalid completion_number" });
    }

    const stickerKeyRaw = getStringValue(req.body?.sticker_key).trim();
    const ratingKeyRaw = getStringValue(req.body?.rating_key).trim();
    const stickerPosXRaw = req.body?.sticker_pos_x;
    const stickerPosYRaw = req.body?.sticker_pos_y;
    const stickerKey = stickerKeyRaw || null;
    const ratingKey = ratingKeyRaw || null;
    const stickerPosX = stickerPosXRaw == null ? null : Number(stickerPosXRaw);
    const stickerPosY = stickerPosYRaw == null ? null : Number(stickerPosYRaw);

    if (stickerKey && !BOOK_COMPLETION_STICKER_KEYS.has(stickerKey)) {
      return res.status(400).json({ error: "Invalid sticker_key" });
    }

    if (ratingKey && !BOOK_COMPLETION_RATING_KEYS.has(ratingKey)) {
      return res.status(400).json({ error: "Invalid rating_key" });
    }

    if (stickerPosX != null && (!Number.isFinite(stickerPosX) || stickerPosX < 0 || stickerPosX > 100)) {
      return res.status(400).json({ error: "Invalid sticker_pos_x" });
    }

    if (stickerPosY != null && (!Number.isFinite(stickerPosY) || stickerPosY < 0 || stickerPosY > 100)) {
      return res.status(400).json({ error: "Invalid sticker_pos_y" });
    }

    const updateResult = db
      .prepare(
        `
          UPDATE student_book_completions
          SET sticker_key = ?, rating_key = ?, sticker_pos_x = ?, sticker_pos_y = ?
          WHERE student_id = ? AND completion_number = ?
        `
      )
      .run(stickerKey, ratingKey, stickerPosX, stickerPosY, student.studentId, completionNumber);

    if (!updateResult.changes) {
      return res.status(404).json({ error: "Completion record not found" });
    }

    const updated = db
      .prepare(
        `
          SELECT completion_number, sticker_key, rating_key, sticker_pos_x, sticker_pos_y
          FROM student_book_completions
          WHERE student_id = ? AND completion_number = ?
          LIMIT 1
        `
      )
      .get(student.studentId, completionNumber);

    return res.json(updated);
  });

  app.get("/api/books/active", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const book = db
      .prepare("SELECT * FROM books WHERE student_id = ? AND is_active = 1 LIMIT 1")
      .get(student.studentId);
    res.json(book || null);
  });

  app.post("/api/books/active", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const bookId = toPositiveInt(req.body?.book_id);
    if (!bookId) {
      return res.status(400).json({ error: "Invalid book_id" });
    }

    const existing = db
      .prepare("SELECT id FROM books WHERE id = ? AND student_id = ? LIMIT 1")
      .get(bookId, student.studentId);

    if (!existing) {
      return res.status(404).json({ error: "Book not found for this student" });
    }

    db.prepare("UPDATE books SET is_active = 0 WHERE student_id = ? AND is_active = 1").run(student.studentId);
    db.prepare("UPDATE books SET is_active = 1 WHERE id = ? AND student_id = ?").run(bookId, student.studentId);

    const updated = db
      .prepare("SELECT * FROM books WHERE id = ? AND student_id = ? LIMIT 1")
      .get(bookId, student.studentId);

    return res.json(updated || null);
  });

  app.post("/api/books", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const { title, author, total_pages } = req.body;
    if (!title || !author || !Number.isFinite(total_pages)) {
      return res.status(400).json({ error: "Missing/invalid title, author, total_pages" });
    }

    const existingActive = db
      .prepare("SELECT id FROM books WHERE student_id = ? AND is_active = 1 LIMIT 1")
      .get(student.studentId);
    const shouldBeActive = !existingActive;

    const result = db
      .prepare(
        "INSERT INTO books (title, author, total_pages, current_page, is_active, student_id) VALUES (?, ?, ?, 0, ?, ?)"
      )
      .run(title, author, total_pages, shouldBeActive ? 1 : 0, student.studentId);

    res.json({ id: result.lastInsertRowid });
  });

  const runSessionTransaction = db.transaction((payload: SessionPayload, studentId: number) => {
    const safeStartPage = Math.max(0, toSafeInt(payload.start_page, 0));
    const safeEndPage = Math.max(0, toSafeInt(payload.end_page, 0));
    const safeChaptersFinished = Math.max(0, toSafeInt(payload.chapters_finished, 0));
    const safeDurationMinutes = Math.max(0, toSafeInt(payload.duration_minutes, 0));
    const safeGoalMinutes =
      payload.goal_minutes == null ? safeDurationMinutes : Math.max(0, toSafeInt(payload.goal_minutes, safeDurationMinutes));
    const overtimeMinutes = Math.max(0, safeDurationMinutes - safeGoalMinutes);
    const overtimeBonusCoins = overtimeMinutes * 3;

    const bookRow = db
      .prepare("SELECT id, title, current_page, total_pages FROM books WHERE id = ? AND student_id = ? LIMIT 1")
      .get(payload.book_id, studentId) as
      | { id?: number; title?: string; current_page?: number; total_pages?: number }
      | undefined;
    if (!bookRow?.id) {
      throw new Error("BOOK_NOT_FOUND");
    }

    const previousBookPage = Math.max(0, toSafeInt(bookRow.current_page, 0));
    const totalBookPages = Math.max(0, toSafeInt(bookRow.total_pages, 0));
    const crossedFinish = totalBookPages > 0 && previousBookPage < totalBookPages && safeEndPage >= totalBookPages;
    const clampedBookPage = totalBookPages > 0 ? Math.min(safeEndPage, totalBookPages) : safeEndPage;

    const streakDays = touchStudentStreak(studentId);
    const streakMultiplier = getStreakXpMultiplier(streakDays);
    const submittedXp = Math.max(0, Math.floor(payload.xp_earned || 0));
    const boostedXpEarned = Math.max(0, Math.round(submittedXp * streakMultiplier));

    const sessionInsert = db
      .prepare(
        `INSERT INTO sessions (book_id, student_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(payload.book_id, studentId, safeStartPage, safeEndPage, safeChaptersFinished, safeDurationMinutes, boostedXpEarned);
    const sessionId = Number(sessionInsert.lastInsertRowid);

    const reflectionEntries = parseReflectionEntries(payload.questions, payload.answers);
    for (const entry of reflectionEntries) {
      db.prepare(
        `
          INSERT INTO session_reflections
          (session_id, student_id, book_id, question_index, question_text, answer_text)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(sessionId, studentId, payload.book_id, entry.question_index, entry.question_text, entry.answer_text);
    }

    db.prepare("UPDATE books SET current_page = ? WHERE id = ? AND student_id = ?").run(
      clampedBookPage,
      payload.book_id,
      studentId
    );

    let bookCompletion:
      | {
          book_id: number;
          title: string;
          total_pages: number;
          completion_number: number;
          completed_at: string;
          sticker_key: null;
          rating_key: null;
          sticker_pos_x: null;
          sticker_pos_y: null;
        }
      | null = null;
    const unlockedAchievements: AchievementUnlock[] = [];
    if (crossedFinish) {
      const completion = tryRecordBookCompletion(studentId, payload.book_id);
      if (completion?.completion_number) {
        bookCompletion = {
          book_id: Number(payload.book_id),
          title: String(bookRow.title ?? "Completed Book"),
          total_pages: totalBookPages,
          completion_number: Number(completion.completion_number),
          completed_at: String(completion.completed_at),
          sticker_key: null,
          rating_key: null,
          sticker_pos_x: null,
          sticker_pos_y: null,
        };
        const bookUnlock = awardBookCompletionAchievement(studentId, completion.completion_number);
        if (bookUnlock) {
          unlockedAchievements.push(bookUnlock);
        }
      }
    }

    const thresholdUnlocks = awardThresholdAchievements(studentId);
    if (thresholdUnlocks.length) {
      unlockedAchievements.push(...thresholdUnlocks);
    }

    const achievementBonusXp = unlockedAchievements.reduce((sum, unlock) => sum + unlock.reward_xp, 0);
    const achievementBonusCoins = unlockedAchievements.reduce((sum, unlock) => sum + unlock.reward_coins, 0);

    const currentStats =
      (db
        .prepare("SELECT total_xp, coins, total_coins_earned FROM user_stats WHERE student_id = ? LIMIT 1")
        .get(studentId) as { total_xp?: number; coins?: number; total_coins_earned?: number } | undefined) ?? {};
    const previousXp = Number(currentStats.total_xp ?? 0);
    const previousCoins = Number(currentStats.coins ?? 0);
    const previousTotalCoinsEarned = Number(currentStats.total_coins_earned ?? 0);
    const safeXpEarned = boostedXpEarned;
    const coinRewards = getSessionCoinRewards(previousXp, safeXpEarned);
    const sessionCoinsEarned = coinRewards.totalCoins + overtimeBonusCoins;
    const totalCoinsEarned = sessionCoinsEarned + achievementBonusCoins;
    const totalXp = previousXp + safeXpEarned + achievementBonusXp;
    const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const newCoins = previousCoins + totalCoinsEarned;
    const newTotalCoinsEarned = previousTotalCoinsEarned + totalCoinsEarned;

    db.prepare(
      `
        UPDATE user_stats
        SET total_xp = ?, level = ?, coins = ?, total_coins_earned = ?
        WHERE student_id = ?
      `
    ).run(totalXp, newLevel, newCoins, newTotalCoinsEarned, studentId);

    return {
      sessionId,
      totalXp,
      level: newLevel,
      coins: newCoins,
      coinsEarned: sessionCoinsEarned,
      milestoneBonusCoins: coinRewards.milestoneCoins,
      milestonesReached: coinRewards.milestonesCrossed,
      overtimeBonusCoins,
      overtimeMinutes,
      xpEarned: safeXpEarned,
      streakDays,
      streakMultiplier,
      achievementBonusXp,
      achievementBonusCoins,
      achievementsUnlocked: unlockedAchievements,
      bookCompletion,
    };
  });

  app.post("/api/sessions", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const { book_id, start_page, end_page, chapters_finished, duration_minutes, goal_minutes, xp_earned, questions, answers } =
      req.body as SessionPayload;

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

    let sessionResult: ReturnType<typeof runSessionTransaction>;
    try {
      sessionResult = runSessionTransaction(
        {
          book_id,
          start_page,
          end_page,
          chapters_finished,
          duration_minutes,
          goal_minutes,
          xp_earned,
          questions,
          answers,
        },
        student.studentId
      );
    } catch (err: any) {
      if (String(err?.message ?? "") === "BOOK_NOT_FOUND") {
        return res.status(404).json({ error: "Book not found for this student" });
      }
      throw err;
    }

    res.json({
      success: true,
      session_id: sessionResult.sessionId,
      total_xp: sessionResult.totalXp,
      level: sessionResult.level,
      coins: sessionResult.coins,
      xp_earned: sessionResult.xpEarned,
      streak_days: sessionResult.streakDays,
      streak_multiplier: sessionResult.streakMultiplier,
      coins_earned: sessionResult.coinsEarned,
      milestone_bonus_coins: sessionResult.milestoneBonusCoins,
      overtime_bonus_coins: sessionResult.overtimeBonusCoins,
      overtime_minutes: sessionResult.overtimeMinutes,
      milestones_reached: sessionResult.milestonesReached,
      achievement_bonus_xp: sessionResult.achievementBonusXp,
      achievement_bonus_coins: sessionResult.achievementBonusCoins,
      achievements_unlocked: sessionResult.achievementsUnlocked,
      book_completion: sessionResult.bookCompletion,
    });
  });

  app.get("/api/room", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    return res.json(buildRoomState(student.studentId));
  });

  app.post("/api/room", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const action = getStringValue(req.body?.action).trim().toLowerCase();
    if (action === "reset_layout_all") {
      db.prepare("UPDATE student_room_items SET pos_x = NULL, pos_y = NULL, z_index = NULL WHERE student_id = ?").run(
        student.studentId
      );
      return res.json(buildRoomState(student.studentId));
    }

    const itemKey = getStringValue(req.body?.item_key).trim();
    const item = roomCatalogByKey.get(itemKey);
    if (!item) {
      return res.status(400).json({ error: "Invalid item_key" });
    }

    const roomStateBefore = buildRoomState(student.studentId);
    const targetItem = roomStateBefore.items.find((row) => row.key === item.key);
    const alreadyOwned = Boolean(targetItem?.owned);

    if (action === "purchase") {
      if (alreadyOwned) {
        return res.status(400).json({ error: "Item already owned" });
      }
      if (!targetItem?.unlocked) {
        return res.status(400).json({ error: "Not enough XP to unlock this item" });
      }
      if (roomStateBefore.coins < item.cost_coins) {
        return res.status(400).json({ error: "Not enough coins" });
      }

      const coinUpdate = db.prepare("UPDATE user_stats SET coins = coins - ? WHERE student_id = ? AND coins >= ?").run(
        item.cost_coins,
        student.studentId,
        item.cost_coins
      );
      if (!coinUpdate.changes) {
        return res.status(400).json({ error: "Not enough coins" });
      }
      db.prepare(
        `
          INSERT INTO student_room_items (student_id, item_key, is_equipped)
          VALUES (?, ?, 1)
          ON CONFLICT(student_id, item_key) DO UPDATE SET is_equipped = 1
        `
      ).run(student.studentId, item.key);
    } else if (action === "equip") {
      if (!alreadyOwned) {
        return res.status(400).json({ error: "Purchase this item first" });
      }
      db.prepare("UPDATE student_room_items SET is_equipped = 1 WHERE student_id = ? AND item_key = ?").run(
        student.studentId,
        item.key
      );
    } else if (action === "unequip") {
      db.prepare("UPDATE student_room_items SET is_equipped = 0 WHERE student_id = ? AND item_key = ?").run(
        student.studentId,
        item.key
      );
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
      db.prepare(
        "UPDATE student_room_items SET pos_x = ?, pos_y = ?, z_index = ? WHERE student_id = ? AND item_key = ?"
      ).run(posX, posY, zIndex, student.studentId, item.key);
    } else if (action === "reset_layout") {
      if (!alreadyOwned) {
        return res.status(400).json({ error: "Purchase this item first" });
      }
      db.prepare("UPDATE student_room_items SET pos_x = NULL, pos_y = NULL, z_index = NULL WHERE student_id = ? AND item_key = ?").run(
        student.studentId,
        item.key
      );
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const categoryKeys = ROOM_ITEM_CATALOG.filter((row) => row.category === item.category)
      .map((row) => row.key)
      .filter((key) => key !== item.key);
    if ((action === "purchase" || action === "equip") && categoryKeys.length > 0) {
      const placeholders = categoryKeys.map(() => "?").join(",");
      db.prepare(
        `UPDATE student_room_items
         SET is_equipped = 0
         WHERE student_id = ? AND item_key IN (${placeholders})`
      ).run(student.studentId, ...categoryKeys);
    }

    return res.json(buildRoomState(student.studentId));
  });

  app.get("/api/admin/roster", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const classRows = db
      .prepare(
        `
        SELECT class_code, COUNT(*) as student_count
        FROM students
        GROUP BY class_code
        ORDER BY class_code
      `
      )
      .all() as Array<{ class_code: string; student_count: number }>;

    const studentRows = db
      .prepare(
        `
        SELECT
          s.id,
          s.class_code,
          s.nickname,
          s.created_at,
          COALESCE(us.total_xp, 0) as total_xp,
          COALESCE(us.level, 1) as level,
          COALESCE(us.coins, 0) as coins,
          COALESCE(us.total_coins_earned, 0) as total_coins_earned,
          COALESCE(ss.total_sessions, 0) as total_sessions,
          COALESCE(ss.total_minutes, 0) as total_minutes,
          COALESCE(au.achievements_unlocked, 0) as achievements_unlocked,
          au.latest_achievement_at,
          ab.title as active_book,
          ab.current_page,
          ab.total_pages
        FROM students s
        LEFT JOIN user_stats us ON us.student_id = s.id
        LEFT JOIN (
          SELECT
            student_id,
            COUNT(*) as total_sessions,
            COALESCE(SUM(duration_minutes), 0) as total_minutes
          FROM sessions
          GROUP BY student_id
        ) ss ON ss.student_id = s.id
        LEFT JOIN (
          SELECT
            student_id,
            COUNT(*) as achievements_unlocked,
            MAX(unlocked_at) as latest_achievement_at
          FROM achievement_unlocks
          GROUP BY student_id
        ) au ON au.student_id = s.id
        LEFT JOIN (
          SELECT
            b.student_id,
            b.title,
            b.current_page,
            b.total_pages
          FROM books b
          WHERE b.id IN (
            SELECT MAX(id)
            FROM books
            WHERE is_active = 1
            GROUP BY student_id
          )
        ) ab ON ab.student_id = s.id
        ORDER BY s.class_code, s.nickname
      `
      )
      .all();

    res.json({
      classes: classRows,
      students: studentRows,
      generated_at: new Date().toISOString(),
    });
  });

  app.get("/api/admin/reflections", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const rows = db
      .prepare(
        `
        SELECT
          sr.session_id,
          s.timestamp,
          st.class_code,
          st.nickname,
          b.title as book_title,
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
      )
      .all() as Array<{
      session_id: number;
      timestamp: string;
      class_code: string;
      nickname: string;
      book_title: string | null;
      question_index: number;
      question_text: string;
      answer_text: string;
    }>;

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

    for (const row of rows) {
      if (!bySession.has(row.session_id)) {
        bySession.set(row.session_id, {
          session_id: row.session_id,
          timestamp: row.timestamp,
          class_code: row.class_code,
          nickname: row.nickname,
          book_title: row.book_title ?? null,
          answers: [],
        });
      }

      bySession.get(row.session_id)!.answers.push({
        question_index: row.question_index ?? 0,
        question_text: row.question_text ?? "",
        answer_text: row.answer_text ?? "",
      });
    }

    res.json({
      reflections: Array.from(bySession.values()),
      generated_at: new Date().toISOString(),
    });
  });

  app.post("/api/admin/coins", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const studentId = toPositiveInt(req.body?.student_id);
    const coins = toPositiveInt(req.body?.coins);
    if (!studentId) {
      return res.status(400).json({ error: "Invalid student_id" });
    }
    if (!coins) {
      return res.status(400).json({ error: "Invalid coins amount" });
    }

    const studentExists = db.prepare("SELECT id FROM students WHERE id = ? LIMIT 1").get(studentId);
    if (!studentExists) {
      return res.status(404).json({ error: "Student not found" });
    }

    const updated = db
      .prepare(
        `
          UPDATE user_stats
          SET coins = COALESCE(coins, 0) + ?, total_coins_earned = COALESCE(total_coins_earned, 0) + ?
          WHERE student_id = ?
        `
      )
      .run(coins, coins, studentId);

    if (updated.changes > 0) {
      const stats = db
        .prepare("SELECT coins, total_coins_earned FROM user_stats WHERE student_id = ? LIMIT 1")
        .get(studentId) as { coins: number; total_coins_earned: number } | undefined;

      return res.json({
        student_id: studentId,
        granted_coins: coins,
        coins: stats?.coins ?? coins,
        total_coins_earned: stats?.total_coins_earned ?? coins,
      });
    }

    db.prepare(
      `
        INSERT INTO user_stats (student_id, total_xp, level, coins, total_coins_earned)
        VALUES (?, 0, 1, ?, ?)
      `
    ).run(studentId, coins, coins);

    return res.json({
      student_id: studentId,
      granted_coins: coins,
      coins,
      total_coins_earned: coins,
    });
  });

  app.post("/api/admin/room-test", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const studentId = toPositiveInt(req.body?.student_id);
    const itemKey = getStringValue(req.body?.item_key).trim();
    const itemKeys =
      Array.isArray(req.body?.item_keys)
        ? Array.from(
            new Set(
              req.body.item_keys
                .map((entry: unknown) => (typeof entry === "string" ? entry.trim() : ""))
                .filter((entry: string) => entry.length > 0)
            )
          )
        : [];
    const keysToGrant = itemKeys.length > 0 ? itemKeys : itemKey ? [itemKey] : [];
    const equip = req.body?.equip === undefined ? true : Boolean(req.body?.equip);
    const posXRaw = req.body?.pos_x;
    const posYRaw = req.body?.pos_y;
    const zIndexRaw = req.body?.z_index;
    const hasPosX = !(posXRaw == null || posXRaw === "");
    const hasPosY = !(posYRaw == null || posYRaw === "");
    const hasZIndex = !(zIndexRaw == null || zIndexRaw === "");
    const posX = hasPosX ? parseRoomPosition(posXRaw) : null;
    const posY = hasPosY ? parseRoomPosition(posYRaw) : null;
    const zIndex = hasZIndex ? parseRoomZIndex(zIndexRaw) : null;

    if (!studentId) {
      return res.status(400).json({ error: "Invalid student_id" });
    }

    if (keysToGrant.length === 0) {
      return res.status(400).json({ error: "Invalid item_key/item_keys" });
    }

    if ((hasPosX && posX == null) || (hasPosY && posY == null) || (hasZIndex && zIndex == null)) {
      return res.status(400).json({ error: "Invalid layout values" });
    }

    const studentExists = db.prepare("SELECT id FROM students WHERE id = ? LIMIT 1").get(studentId);
    if (!studentExists) {
      return res.status(404).json({ error: "Student not found" });
    }

    const upsertRoomItem = db.prepare(
      `
        INSERT INTO student_room_items (student_id, item_key, is_equipped, pos_x, pos_y, z_index)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, item_key)
        DO UPDATE SET
          is_equipped = CASE WHEN excluded.is_equipped = 1 THEN 1 ELSE student_room_items.is_equipped END,
          pos_x = COALESCE(excluded.pos_x, student_room_items.pos_x),
          pos_y = COALESCE(excluded.pos_y, student_room_items.pos_y),
          z_index = COALESCE(excluded.z_index, student_room_items.z_index)
      `
    );
    const grantItems = db.transaction((itemKeyList: string[]) => {
      for (const key of itemKeyList) {
        upsertRoomItem.run(studentId, key, equip ? 1 : 0, posX, posY, zIndex);
      }
    });
    grantItems(keysToGrant);

    const counts = db
      .prepare(
        `
          SELECT
            COUNT(*) as owned_count,
            SUM(CASE WHEN is_equipped = 1 THEN 1 ELSE 0 END) as equipped_count
          FROM student_room_items
          WHERE student_id = ?
        `
      )
      .get(studentId) as { owned_count?: number; equipped_count?: number } | undefined;

    return res.json({
      student_id: studentId,
      item_key: keysToGrant[0] ?? null,
      granted_count: keysToGrant.length,
      granted_keys: keysToGrant,
      equipped: equip,
      owned_count: Number(counts?.owned_count ?? 0),
      equipped_count: Number(counts?.equipped_count ?? 0),
    });
  });

  app.post("/api/admin/students", (req, res) => {
    if (!requireAdmin(req, res)) return;

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
      const insertResult = db
        .prepare("INSERT OR IGNORE INTO students (class_code, nickname) VALUES (?, ?)")
        .run(classCode, nickname);

      if (insertResult.changes > 0) {
        createdCount += 1;
      } else {
        existingCount += 1;
      }

      const student = db
        .prepare("SELECT id FROM students WHERE class_code = ? AND nickname = ? LIMIT 1")
        .get(classCode, nickname) as { id?: number } | undefined;

      if (student?.id) {
        db
          .prepare(
            "INSERT OR IGNORE INTO user_stats (student_id, total_xp, level, coins, total_coins_earned) VALUES (?, 0, 1, 0, 0)"
          )
          .run(student.id);
      }
    }

    return res.json({
      class_code: classCode,
      created_count: createdCount,
      existing_count: existingCount,
      invalid_nicknames: invalidNicknames,
    });
  });

  app.delete("/api/admin/students", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const studentId = toPositiveInt(req.body?.student_id);
    if (!studentId) {
      return res.status(400).json({ error: "Invalid student_id" });
    }

    const deleteStudentData = db.transaction((id: number) => {
      const deletedAchievementUnlocks = db.prepare("DELETE FROM achievement_unlocks WHERE student_id = ?").run(id).changes;
      const deletedBookCompletions = db.prepare("DELETE FROM student_book_completions WHERE student_id = ?").run(id).changes;
      const deletedReflections = db.prepare("DELETE FROM session_reflections WHERE student_id = ?").run(id).changes;
      const deletedRoomItems = db.prepare("DELETE FROM student_room_items WHERE student_id = ?").run(id).changes;
      const deletedSessions = db.prepare("DELETE FROM sessions WHERE student_id = ?").run(id).changes;
      const deletedBooks = db.prepare("DELETE FROM books WHERE student_id = ?").run(id).changes;
      const deletedStats = db.prepare("DELETE FROM user_stats WHERE student_id = ?").run(id).changes;
      const deletedStudents = db.prepare("DELETE FROM students WHERE id = ?").run(id).changes;

      return {
        deleted_students: deletedStudents,
        deleted_achievement_unlocks: deletedAchievementUnlocks,
        deleted_book_completions: deletedBookCompletions,
        deleted_reflections: deletedReflections,
        deleted_room_items: deletedRoomItems,
        deleted_sessions: deletedSessions,
        deleted_books: deletedBooks,
        deleted_stats: deletedStats,
      };
    });

    return res.json(deleteStudentData(studentId));
  });

  app.delete("/api/admin/classes", (req, res) => {
    if (!requireAdmin(req, res)) return;

    const classCode = normalizeClassCode(req.body?.class_code);
    if (!CLASS_CODE_REGEX.test(classCode)) {
      return res.status(400).json({ error: "Invalid class_code format" });
    }

    const deleteClassData = db.transaction((code: string) => {
      const studentIds = db
        .prepare("SELECT id FROM students WHERE class_code = ?")
        .all(code) as Array<{ id: number }>;
      const ids = studentIds.map((row) => row.id);

      if (ids.length === 0) {
        return {
          class_code: code,
          deleted_students: 0,
          deleted_achievement_unlocks: 0,
          deleted_book_completions: 0,
          deleted_reflections: 0,
          deleted_room_items: 0,
          deleted_sessions: 0,
          deleted_books: 0,
          deleted_stats: 0,
        };
      }

      const placeholders = ids.map(() => "?").join(",");
      const deletedAchievementUnlocks = db
        .prepare(`DELETE FROM achievement_unlocks WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedBookCompletions = db
        .prepare(`DELETE FROM student_book_completions WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedReflections = db
        .prepare(`DELETE FROM session_reflections WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedRoomItems = db
        .prepare(`DELETE FROM student_room_items WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedSessions = db
        .prepare(`DELETE FROM sessions WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedBooks = db
        .prepare(`DELETE FROM books WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedStats = db
        .prepare(`DELETE FROM user_stats WHERE student_id IN (${placeholders})`)
        .run(...ids).changes;
      const deletedStudents = db
        .prepare("DELETE FROM students WHERE class_code = ?")
        .run(code).changes;

      return {
        class_code: code,
        deleted_students: deletedStudents,
        deleted_achievement_unlocks: deletedAchievementUnlocks,
        deleted_book_completions: deletedBookCompletions,
        deleted_reflections: deletedReflections,
        deleted_room_items: deletedRoomItems,
        deleted_sessions: deletedSessions,
        deleted_books: deletedBooks,
        deleted_stats: deletedStats,
      };
    });

    return res.json(deleteClassData(classCode));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
