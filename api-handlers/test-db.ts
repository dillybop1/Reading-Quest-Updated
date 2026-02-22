import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const result = await query("SELECT NOW() as now");
    res.status(200).json({ ok: true, now: result.rows[0].now });
  } catch (err: any) {
    console.error("DB ERROR:", err);
    res.status(500).json({
      ok: false,
      error: String(err?.message ?? err),
      code: err?.code ?? null,
    });
  }
}