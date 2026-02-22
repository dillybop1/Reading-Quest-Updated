import pg from "pg";
const { Pool } = pg;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const globalPoolKey = "__readingQuestPool";
const configuredMax = parsePositiveInt(process.env.DB_POOL_MAX || process.env.PG_POOL_MAX, 1);
const configuredConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

const createPool = () => {
  if (!configuredConnectionString) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL (or POSTGRES_URL) in your Vercel project environment variables."
    );
  }

  const shouldUseSsl =
    process.env.DB_SSL === "true" ||
    (!configuredConnectionString.includes("localhost") && !configuredConnectionString.includes("127.0.0.1"));

  return new Pool({
    connectionString: configuredConnectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
    max: configuredMax,
    connectionTimeoutMillis: parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
    idleTimeoutMillis: parsePositiveInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  });
};

let pool = globalThis[globalPoolKey] || null;

const getPool = () => {
  if (!pool) {
    pool = createPool();
    globalThis[globalPoolKey] = pool;
  }
  return pool;
};

export const query = (text, params) => getPool().query(text, params);

export const withTransaction = async (callback) => {
  const client = await getPool().connect();
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
