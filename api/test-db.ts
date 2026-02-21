import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    const result = await query("SELECT NOW() as now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
}