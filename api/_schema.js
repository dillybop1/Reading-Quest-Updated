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
        level INTEGER DEFAULT 1
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

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS students_class_nickname_key
      ON students(class_code, nickname)
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_stats_student_id_key
      ON user_stats(student_id)
    `);
    await query(`CREATE INDEX IF NOT EXISTS books_student_id_idx ON books(student_id)`);
    await query(`CREATE INDEX IF NOT EXISTS books_student_active_idx ON books(student_id, is_active)`);
    await query(`CREATE INDEX IF NOT EXISTS sessions_student_id_idx ON sessions(student_id)`);
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
};
