import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const SMOKE_PORT = Number.parseInt(String(process.env.ACHIEVEMENT_SMOKE_PORT ?? "3107"), 10);
const BASE_URL = (process.env.ACHIEVEMENT_SMOKE_BASE_URL || `http://127.0.0.1:${SMOKE_PORT}`).replace(/\/+$/, "");
const AUTO_START_SERVER = process.env.ACHIEVEMENT_SMOKE_AUTO_START !== "0";
const ADMIN_KEY = (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_KEY || "Umphress1997!").trim();
const REQUEST_TIMEOUT_MS = 8000;

const BOOK_KEY_PREFIX = "book_complete";

const expectedBookRewards = [
  { key: "book_complete_1", xp: 150, coins: 120 },
  { key: "book_complete_2", xp: 225, coins: 180 },
  { key: "book_complete_3", xp: 300, coins: 240 },
  { key: "book_complete_4", xp: 375, coins: 300 },
  { key: "book_complete_5", xp: 450, coins: 360 },
  { key: "book_complete_repeat", xp: 450, coins: 360 },
  { key: "book_complete_repeat", xp: 450, coins: 360 },
];

const randomSuffix = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const classCode = `SMK-${Date.now().toString().slice(-6)}${randomSuffix().slice(0, 2)}`;
const nickname = `Smoke${randomSuffix().slice(0, 6)}`;

const withStudentQuery = (path) => {
  const query = new URLSearchParams({ class_code: classCode, nickname }).toString();
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
};

const withTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const pingServer = async () => {
  try {
    const response = await withTimeout(`${BASE_URL}/`);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
};

const startServer = () => {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd" : "node_modules/.bin/tsx";
  const args = isWin ? ["/c", "node_modules\\.bin\\tsx.cmd", "server.ts"] : ["server.ts"];
  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(SMOKE_PORT),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk ?? "");
    if (text.trim()) {
      process.stdout.write(`[dev] ${text}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk ?? "");
    if (text.trim()) {
      process.stderr.write(`[dev] ${text}`);
    }
  });

  return child;
};

const stopServer = async (child) => {
  if (!child || child.killed) return;

  if (process.platform === "win32" && Number.isFinite(child.pid) && child.pid > 0) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Ignore and continue to hard kill attempt below.
  }

  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode !== null) return;
    await delay(100);
  }

  try {
    child.kill("SIGKILL");
  } catch {
    // Ignore if process already exited.
  }
};

const requestJson = async (path, { method = "GET", body, headers } = {}) => {
  const response = await withTimeout(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload && typeof payload === "object" ? JSON.stringify(payload) : String(payload);
    throw new Error(`Request failed ${method} ${path}: ${response.status} ${details}`);
  }

  return payload;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const extractBookUnlocks = (sessionResponse) => {
  const unlocks = Array.isArray(sessionResponse?.achievements_unlocked) ? sessionResponse.achievements_unlocked : [];
  return unlocks.filter((item) => String(item?.key || "").startsWith(BOOK_KEY_PREFIX));
};

const createBook = async (index) => {
  const payload = await requestJson("/api/books", {
    method: "POST",
    body: {
      class_code: classCode,
      nickname,
      title: `Smoke Test Book ${index}`,
      author: "Automation",
      total_pages: 100,
    },
  });

  const id = Number(payload?.id ?? payload?.book?.id ?? payload?.book_id);
  assert(Number.isFinite(id) && id > 0, `Could not parse created book id from response: ${JSON.stringify(payload)}`);
  return id;
};

const submitSession = async ({ bookId, startPage, endPage, duration = 20, goal = 20, xp = 150 }) =>
  requestJson("/api/sessions", {
    method: "POST",
    body: {
      class_code: classCode,
      nickname,
      book_id: bookId,
      start_page: startPage,
      end_page: endPage,
      chapters_finished: 1,
      duration_minutes: duration,
      goal_minutes: goal,
      xp_earned: xp,
      questions: ["Smoke question"],
      answers: ["Smoke answer"],
    },
  });

const cleanupStudent = async () => {
  try {
    const roster = await requestJson("/api/admin/roster", {
      method: "GET",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    const students = Array.isArray(roster?.students) ? roster.students : [];
    const row = students.find((student) => student.class_code === classCode && student.nickname === nickname);
    if (!row?.id) return;

    await requestJson("/api/admin/students", {
      method: "DELETE",
      headers: { "x-admin-key": ADMIN_KEY },
      body: { student_id: row.id },
    });
  } catch (err) {
    console.warn(`[WARN] Cleanup failed: ${String(err?.message || err)}`);
  }
};

const run = async () => {
  let spawnedServer = null;
  try {
    const reachable = await pingServer();
    if (!reachable && !AUTO_START_SERVER) {
      throw new Error(`Server is not reachable at ${BASE_URL} and auto-start is disabled.`);
    }

    if (!reachable && AUTO_START_SERVER) {
      console.log(`[INFO] Starting local dev server at ${BASE_URL}...`);
      spawnedServer = startServer();
    }

    if (!reachable) {
      let ready = false;
      for (let i = 0; i < 90; i += 1) {
        if (await pingServer()) {
          ready = true;
          break;
        }
        await delay(500);
      }
      assert(ready, "Timed out waiting for local server startup.");
    }

    console.log(`[INFO] Running achievement smoke tests with student ${classCode}/${nickname}`);

    const completionUnlocks = [];

    const firstBookId = await createBook(1);
    const firstSession = await submitSession({ bookId: firstBookId, startPage: 90, endPage: 100 });
    const firstBookUnlocks = extractBookUnlocks(firstSession);
    assert(firstBookUnlocks.length === 1, `Expected 1 book unlock for 90->100, got ${firstBookUnlocks.length}`);
    assert(
      firstBookUnlocks[0].key === "book_complete_1",
      `Expected first unlock key book_complete_1, got ${String(firstBookUnlocks[0].key)}`
    );
    completionUnlocks.push(firstBookUnlocks[0]);

    const secondSessionSameBook = await submitSession({ bookId: firstBookId, startPage: 100, endPage: 110 });
    const duplicateBookUnlocks = extractBookUnlocks(secondSessionSameBook);
    assert(duplicateBookUnlocks.length === 0, `Expected no duplicate book unlock on 100->110, got ${duplicateBookUnlocks.length}`);

    for (let bookIndex = 2; bookIndex <= 7; bookIndex += 1) {
      const bookId = await createBook(bookIndex);
      const sessionResult = await submitSession({ bookId, startPage: 0, endPage: 100 });
      const bookUnlocks = extractBookUnlocks(sessionResult);
      assert(bookUnlocks.length === 1, `Expected 1 book unlock for book #${bookIndex}, got ${bookUnlocks.length}`);
      completionUnlocks.push(bookUnlocks[0]);
    }

    assert(
      completionUnlocks.length === expectedBookRewards.length,
      `Expected ${expectedBookRewards.length} completion unlocks, got ${completionUnlocks.length}`
    );

    for (let i = 0; i < expectedBookRewards.length; i += 1) {
      const expected = expectedBookRewards[i];
      const actual = completionUnlocks[i] || {};
      assert(
        actual.key === expected.key,
        `Completion #${i + 1}: expected key ${expected.key}, got ${String(actual.key)}`
      );
      assert(
        Number(actual.reward_xp) === expected.xp,
        `Completion #${i + 1}: expected XP ${expected.xp}, got ${Number(actual.reward_xp)}`
      );
      assert(
        Number(actual.reward_coins) === expected.coins,
        `Completion #${i + 1}: expected coins ${expected.coins}, got ${Number(actual.reward_coins)}`
      );
    }

    const achievements = await requestJson(withStudentQuery("/api/achievements"));
    assert(
      Number(achievements?.completed_books_count) === 7,
      `Expected completed_books_count=7, got ${Number(achievements?.completed_books_count)}`
    );

    const checklist = Array.isArray(achievements?.achievements) ? achievements.achievements : [];
    const repeatRow = checklist.find((item) => item?.key === "book_complete_repeat");
    assert(Boolean(repeatRow), "Missing book_complete_repeat in checklist response.");
    assert(Number(repeatRow.times_earned) === 2, `Expected repeat times_earned=2, got ${Number(repeatRow.times_earned)}`);

    console.log("[PASS] Achievement smoke test passed.");
    console.log("  - 90->100 triggers first completion reward");
    console.log("  - 100->110 does not duplicate completion reward");
    console.log("  - Book completion rewards for #1-#7 match expected curve");
  } finally {
    await cleanupStudent();
    await stopServer(spawnedServer);
  }
};

run().catch((err) => {
  console.error(`[FAIL] ${String(err?.message || err)}`);
  process.exitCode = 1;
});
