import type { VercelRequest, VercelResponse } from "@vercel/node";
import achievementsHandler from "../api-handlers/achievements.ts";
import roomHandler from "../api-handlers/room.ts";
import sessionsHandler from "../api-handlers/sessions.ts";
import statsHandler from "../api-handlers/stats.ts";
import testDbHandler from "../api-handlers/test-db.ts";
import booksActiveHandler from "../api-handlers/books/active.ts";
import booksCompletedHandler from "../api-handlers/books/completed.ts";
import booksIndexHandler from "../api-handlers/books/index.ts";
import adminClassesHandler from "../api-handlers/admin/classes.ts";
import adminCoinsHandler from "../api-handlers/admin/coins.ts";
import adminReflectionsHandler from "../api-handlers/admin/reflections.ts";
import adminRoomTestHandler from "../api-handlers/admin/room-test.ts";
import adminRosterHandler from "../api-handlers/admin/roster.ts";
import adminStarterTemplateHandler from "../api-handlers/admin/starter-template.ts";
import adminStudentsHandler from "../api-handlers/admin/students.ts";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const ROUTES: Record<string, Handler> = {
  "/api/achievements": achievementsHandler,
  "/api/room": roomHandler,
  "/api/sessions": sessionsHandler,
  "/api/stats": statsHandler,
  "/api/test-db": testDbHandler,
  "/api/books": booksIndexHandler,
  "/api/books/active": booksActiveHandler,
  "/api/books/completed": booksCompletedHandler,
  "/api/admin/classes": adminClassesHandler,
  "/api/admin/coins": adminCoinsHandler,
  "/api/admin/reflections": adminReflectionsHandler,
  "/api/admin/room-test": adminRoomTestHandler,
  "/api/admin/roster": adminRosterHandler,
  "/api/admin/starter-template": adminStarterTemplateHandler,
  "/api/admin/students": adminStudentsHandler,
};

const normalizePath = (rawUrl: string | undefined) => {
  const url = new URL(rawUrl || "/", "http://localhost");
  const trimmed = url.pathname.replace(/\/+$/, "");
  return trimmed || "/";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathQuery = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
  const pathname = typeof pathQuery === "string" && pathQuery.trim() ? normalizePath(pathQuery) : normalizePath(req.url);
  const routeHandler = ROUTES[pathname];

  if (!routeHandler) {
    return res.status(404).json({ error: "Not found" });
  }

  return routeHandler(req, res);
}
