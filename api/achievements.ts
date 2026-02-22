import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./_db.js";
import { resolveStudent } from "./_student.js";
import { buildAchievementsResponse } from "./_achievements.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const student = await resolveStudent(req);
    if ("error" in student) {
      return res.status(400).json({ error: student.error });
    }

    const payload = await buildAchievementsResponse({ query }, student.studentId);
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}
