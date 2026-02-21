import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("reading_quest.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    total_pages INTEGER NOT NULL,
    current_page INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    start_page INTEGER,
    end_page INTEGER,
    chapters_finished INTEGER,
    duration_minutes INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    xp_earned INTEGER,
    FOREIGN KEY(book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  );
`);

// Ensure user_stats has a row
const stats = db.prepare("SELECT * FROM user_stats LIMIT 1").get();
if (!stats) {
  db.prepare("INSERT INTO user_stats (total_xp, level) VALUES (0, 1)").run();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    const stats = db.prepare("SELECT * FROM user_stats LIMIT 1").get();
    const totalSessions = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
    const totalMinutes = db.prepare("SELECT SUM(duration_minutes) as total FROM sessions").get() as { total: number };
    const totalBooks = db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number };
    
    res.json({
      ...stats,
      total_sessions: totalSessions.count,
      total_hours: Math.round((totalMinutes.total || 0) / 60 * 10) / 10,
      total_books: totalBooks.count
    });
  });

  app.get("/api/books", (req, res) => {
    const books = db.prepare("SELECT * FROM books").all();
    res.json(books);
  });

  app.get("/api/books/active", (req, res) => {
    const book = db.prepare("SELECT * FROM books WHERE is_active = 1 LIMIT 1").get();
    res.json(book || null);
  });

  app.post("/api/books", (req, res) => {
    const { title, author, total_pages } = req.body;
    // Deactivate all other books
    db.prepare("UPDATE books SET is_active = 0").run();
    const result = db.prepare("INSERT INTO books (title, author, total_pages, is_active) VALUES (?, ?, ?, 1)").run(title, author, total_pages);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/sessions", (req, res) => {
    const { book_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned } = req.body;
    
    db.transaction(() => {
      // Record session
      db.prepare(`
        INSERT INTO sessions (book_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(book_id, start_page, end_page, chapters_finished, duration_minutes, xp_earned);

      // Update book progress
      db.prepare("UPDATE books SET current_page = ? WHERE id = ?").run(end_page, book_id);

      // Update user XP
      db.prepare("UPDATE user_stats SET total_xp = total_xp + ?").run(xp_earned);
      
      // Recalculate level (simple level up every 500 XP)
      const stats = db.prepare("SELECT total_xp FROM user_stats LIMIT 1").get() as { total_xp: number };
      const newLevel = Math.floor(stats.total_xp / 500) + 1;
      db.prepare("UPDATE user_stats SET level = ?").run(newLevel);
    })();

    res.json({ success: true });
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
