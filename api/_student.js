import { query } from "./_db.js";
import { ensureSchema } from "./_schema.js";

const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const NICKNAME_REGEX = /^[A-Za-z0-9 _.-]{2,24}$/;

const getStringValue = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const normalizeClassCode = (value) => getStringValue(value).trim().toUpperCase();
const normalizeNickname = (value) => getStringValue(value).trim();

const getRequestField = (req, key) => {
  const queryValue = getStringValue(req.query?.[key]);
  if (queryValue) return queryValue;
  return getStringValue(req.body?.[key]);
};

export const parseStudentIdentity = (req) => {
  const classCode = normalizeClassCode(getRequestField(req, "class_code"));
  const nickname = normalizeNickname(getRequestField(req, "nickname"));

  if (!classCode || !nickname) {
    return { error: "Missing class_code or nickname" };
  }

  if (!CLASS_CODE_REGEX.test(classCode)) {
    return { error: "Invalid class_code format" };
  }

  if (!NICKNAME_REGEX.test(nickname)) {
    return { error: "Invalid nickname format" };
  }

  return { classCode, nickname };
};

export const resolveStudent = async (req) => {
  await ensureSchema();

  const parsed = parseStudentIdentity(req);
  if ("error" in parsed) return parsed;

  const { classCode, nickname } = parsed;
  const upserted = await query(
    `
      INSERT INTO students (class_code, nickname)
      VALUES ($1, $2)
      ON CONFLICT (class_code, nickname)
      DO UPDATE SET nickname = EXCLUDED.nickname
      RETURNING id
    `,
    [classCode, nickname]
  );

  const studentId = upserted.rows[0]?.id;
  if (!Number.isFinite(studentId)) {
    return { error: "Unable to resolve student identity" };
  }

  await query(
    `
      INSERT INTO user_stats (student_id, total_xp, level)
      VALUES ($1, 0, 1)
      ON CONFLICT (student_id) DO NOTHING
    `,
    [studentId]
  );

  return { studentId, classCode, nickname };
};
