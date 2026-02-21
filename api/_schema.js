import { query } from "./_db.js";

let schemaPromise = null;

export const ensureSchema = async () => {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        class_code TEXT NOT NULL,
        nickname TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        total_pages INTEGER NOT NULL,
        current_page INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT false,
        student_id INTEGER REFERENCES students(id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id),
        student_id INTEGER REFERENCES students(id),
        start_page INTEGER,
        end_page INTEGER,
        chapters_finished INTEGER,
        duration_minutes INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        xp_earned INTEGER
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        total_xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        coins INTEGER DEFAULT 0,
        total_coins_earned INTEGER DEFAULT 0
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS session_reflections (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id),
        student_id INTEGER REFERENCES students(id),
        book_id INTEGER REFERENCES books(id),
        question_index INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS student_room_items (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        item_key TEXT NOT NULL,
        is_equipped BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS student_id INTEGER`);
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_id INTEGER`);
    await query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS student_id INTEGER`);

    await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 0`);
    await query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS xp_earned INTEGER`);
    await query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0`);
    await query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1`);
    await query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0`);
    await query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_coins_earned INTEGER DEFAULT 0`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS student_id INTEGER`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS book_id INTEGER`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS question_index INTEGER`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS question_text TEXT`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS answer_text TEXT`);
    await query(`ALTER TABLE session_reflections ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS student_id INTEGER`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS item_key TEXT`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS is_equipped BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS pos_x REAL`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS pos_y REAL`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS z_index INTEGER`);
    await query(`ALTER TABLE student_room_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS students_class_nickname_key
      ON students(class_code, nickname)
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_stats_student_id_key
      ON user_stats(student_id)
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS student_room_items_student_item_key
      ON student_room_items(student_id, item_key)
    `);
    await query(`CREATE INDEX IF NOT EXISTS books_student_id_idx ON books(student_id)`);
    await query(`CREATE INDEX IF NOT EXISTS books_student_active_idx ON books(student_id, is_active)`);
    await query(`CREATE INDEX IF NOT EXISTS sessions_student_id_idx ON sessions(student_id)`);
    await query(`CREATE INDEX IF NOT EXISTS session_reflections_student_id_idx ON session_reflections(student_id)`);
    await query(`CREATE INDEX IF NOT EXISTS session_reflections_session_id_idx ON session_reflections(session_id)`);
    await query(`CREATE INDEX IF NOT EXISTS student_room_items_student_id_idx ON student_room_items(student_id)`);
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
};
