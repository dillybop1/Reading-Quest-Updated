const getStringValue = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const getRequestField = (req, key) => {
  const queryValue = getStringValue(req.query?.[key]);
  if (queryValue) return queryValue;
  return getStringValue(req.body?.[key]);
};

const getAdminKeyFromRequest = (req) => {
  const headerKey = getStringValue(req.headers?.["x-admin-key"]);
  if (headerKey) return headerKey.trim();

  const requestKey = getRequestField(req, "admin_key");
  return requestKey.trim();
};

export const requireAdmin = (req) => {
  const configuredKey = (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_KEY || "Umphress1997!").trim();
  if (!configuredKey) {
    return {
      ok: false,
      status: 503,
      error: "Admin access is not configured. Set ADMIN_ACCESS_CODE.",
    };
  }

  const providedKey = getAdminKeyFromRequest(req);
  if (!providedKey || providedKey !== configuredKey) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized admin access",
    };
  }

  return { ok: true };
};
