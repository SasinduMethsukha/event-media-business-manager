export function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = req.auth?.permissions || [];
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}
