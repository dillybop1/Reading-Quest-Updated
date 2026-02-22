import pg from "pg";
const { Pool } = pg;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const globalPoolKey = "__readingQuestPool";
const configuredMax = parsePositiveInt(process.env.DB_POOL_MAX || process.env.PG_POOL_MAX, 1);

const createPool = () =>
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: configuredMax,
    connectionTimeoutMillis: parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
    idleTimeoutMillis: parsePositiveInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  });

const pool = globalThis[globalPoolKey] || createPool();
if (!globalThis[globalPoolKey]) {
  globalThis[globalPoolKey] = pool;
}

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures and bubble original error.
    }
    throw err;
  } finally {
    client.release();
  }
};
