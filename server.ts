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
ensureColumn("session_reflections", "session_id", "INTEGER");
ensureColumn("session_reflections", "student_id", "INTEGER");
ensureColumn("session_reflections", "book_id", "INTEGER");
ensureColumn("session_reflections", "question_index", "INTEGER");
ensureColumn("session_reflections", "question_text", "TEXT");
ensureColumn("session_reflections", "answer_text", "TEXT");
ensureColumn("session_reflections", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_nickname ON students(class_code, nickname);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stats_student_id ON user_stats(student_id);
  CREATE INDEX IF NOT EXISTS idx_books_student_id ON books(student_id);
  CREATE INDEX IF NOT EXISTS idx_books_student_active ON books(student_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
  CREATE INDEX IF NOT EXISTS idx_reflections_student_id ON session_reflections(student_id);
  CREATE INDEX IF NOT EXISTS idx_reflections_session_id ON session_reflections(session_id);
`);

const XP_PER_LEVEL = 500;
const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const NICKNAME_REGEX = /^[A-Za-z0-9 _.-]{2,24}$/;
const ADMIN_ACCESS_CODE = (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_KEY || "Umphress1997!").trim();

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
  xp_earned: number;
  questions?: string[];
  answers?: string[];
};

const getStringValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
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

  db.prepare("INSERT OR IGNORE INTO user_stats (student_id, total_xp, level) VALUES (?, 0, 1)").run(student.id);
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
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const stats =
      (db.prepare("SELECT * FROM user_stats WHERE student_id = ? LIMIT 1").get(student.studentId) as
        | { total_xp: number; level: number }
        | undefined) ?? { total_xp: 0, level: 1 };

    const totalSessions = db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE student_id = ?")
      .get(student.studentId) as { count: number };
    const totalMinutes = db
      .prepare("SELECT COALESCE(SUM(duration_minutes), 0) as total FROM sessions WHERE student_id = ?")
      .get(student.studentId) as { total: number };
    const totalBooks = db
      .prepare("SELECT COUNT(*) as count FROM books WHERE student_id = ?")
      .get(student.studentId) as { count: number };

    res.json({
      ...stats,
      total_sessions: totalSessions.count,
      total_hours: Math.round(((totalMinutes.total || 0) / 60) * 10) / 10,
      total_books: totalBooks.count,
    });
  });

  app.get("/api/books", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const books = db.prepare("SELECT * FROM books WHERE student_id = ? ORDER BY id DESC").all(student.studentId);
    res.json(books);
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
    const sessionInsert = db
      .prepare(
        `INSERT INTO sessions (book_id, student_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payload.book_id,
        studentId,
        payload.start_page,
        payload.end_page,
        payload.chapters_finished,
        payload.duration_minutes,
        payload.xp_earned
      );
    const sessionId = Number(sessionInsert.lastInsertRowid);

    const reflectionEntries = parseReflectionEntries(payload.questions, payload.answers);
    for (const entry of reflectionEntries) {
      db.prepare(
        `
          INSERT INTO session_reflections
          (session_id, student_id, book_id, question_index, question_text, answer_text)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(
        sessionId,
        studentId,
        payload.book_id,
        entry.question_index,
        entry.question_text,
        entry.answer_text
      );
    }

    db.prepare("UPDATE books SET current_page = ? WHERE id = ? AND student_id = ?").run(
      payload.end_page,
      payload.book_id,
      studentId
    );

    db.prepare("UPDATE user_stats SET total_xp = total_xp + ? WHERE student_id = ?").run(payload.xp_earned, studentId);

    const stats = db
      .prepare("SELECT total_xp FROM user_stats WHERE student_id = ? LIMIT 1")
      .get(studentId) as { total_xp: number };
    const newLevel = Math.floor((stats?.total_xp ?? 0) / XP_PER_LEVEL) + 1;

    db.prepare("UPDATE user_stats SET level = ? WHERE student_id = ?").run(newLevel, studentId);

    return sessionId;
  });

  app.post("/api/sessions", (req, res) => {
    const student = resolveStudent(req, res);
    if (!student) return;

    const { book_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned, questions, answers } =
      req.body as SessionPayload;

    if (
      !Number.isFinite(book_id) ||
      !Number.isFinite(start_page) ||
      !Number.isFinite(end_page) ||
      !Number.isFinite(chapters_finished) ||
      !Number.isFinite(duration_minutes) ||
      !Number.isFinite(xp_earned)
    ) {
      return res.status(400).json({ error: "Invalid session payload" });
    }

    const existingBook = db
      .prepare("SELECT id FROM books WHERE id = ? AND student_id = ? LIMIT 1")
      .get(book_id, student.studentId);

    if (!existingBook) {
      return res.status(404).json({ error: "Book not found for this student" });
    }

    const sessionId = runSessionTransaction(
      {
        book_id,
        start_page,
        end_page,
        chapters_finished,
        duration_minutes,
        xp_earned,
        questions,
        answers,
      },
      student.studentId
    );

    res.json({ success: true, session_id: sessionId });
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
          COALESCE(ss.total_sessions, 0) as total_sessions,
          COALESCE(ss.total_minutes, 0) as total_minutes,
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
        db.prepare("INSERT OR IGNORE INTO user_stats (student_id, total_xp, level) VALUES (?, 0, 1)").run(student.id);
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
      const deletedReflections = db.prepare("DELETE FROM session_reflections WHERE student_id = ?").run(id).changes;
      const deletedSessions = db.prepare("DELETE FROM sessions WHERE student_id = ?").run(id).changes;
      const deletedBooks = db.prepare("DELETE FROM books WHERE student_id = ?").run(id).changes;
      const deletedStats = db.prepare("DELETE FROM user_stats WHERE student_id = ?").run(id).changes;
      const deletedStudents = db.prepare("DELETE FROM students WHERE id = ?").run(id).changes;

      return {
        deleted_students: deletedStudents,
        deleted_reflections: deletedReflections,
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
          deleted_reflections: 0,
          deleted_sessions: 0,
          deleted_books: 0,
          deleted_stats: 0,
        };
      }

      const placeholders = ids.map(() => "?").join(",");
      const deletedReflections = db
        .prepare(`DELETE FROM session_reflections WHERE student_id IN (${placeholders})`)
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
        deleted_reflections: deletedReflections,
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
