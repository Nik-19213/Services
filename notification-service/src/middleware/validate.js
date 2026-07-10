/**
 * Optional API key guard.
 * If API_KEY is set in .env, every request must include:
 *   X-Api-Key: <value>
 * If API_KEY is empty/unset, the guard is disabled (open service).
 */
function apiKeyGuard(req, res, next) {
  const requiredKey = process.env.API_KEY;
  if (!requiredKey) return next();

  const provided = req.headers["x-api-key"];
  if (!provided || provided !== requiredKey) {
    return res.status(401).json({ success: false, error: "Unauthorized — invalid or missing X-Api-Key" });
  }
  next();
}

/**
 * Validate that required fields are present and non-empty strings.
 * @param {string[]} fields
 */
function requireFields(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const val = req.body[field];
      if (!val || typeof val !== "string" || val.trim() === "") {
        return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
      }
    }
    next();
  };
}

module.exports = { apiKeyGuard, requireFields };
