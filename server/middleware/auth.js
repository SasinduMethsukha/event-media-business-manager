// Reference Express/Fastify middleware.
// In production, verify Supabase JWTs using the official Supabase server client
// or JWT verification library. Never trust a role supplied by the browser.
export async function requireAuth(req, res, next) {
  try {
    // 1. Read Authorization: Bearer <access_token>
    // 2. Verify token signature/audience/expiry.
    // 3. Resolve user + workspace + role server-side.
    // 4. Attach req.auth = { userId, workspaceId, role }.
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
}
