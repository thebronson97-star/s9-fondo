'use strict';

// gui/auth.js — middleware para proteger endpoints /api si GUI_API_KEY está configurado
// Behavior: if process.env.GUI_API_KEY is set, require requests to provide that key via:
//  - X-API-KEY header, or
//  - Authorization: Bearer <key>, or
//  - ?apiKey=<key> query param
// If GUI_API_KEY is not set, middleware is a no-op (backwards compatibility for local dev).

module.exports = function (req, res, next) {
  try {
    const key = process.env.GUI_API_KEY || process.env.ADMIN_TOKEN || '';
    if (!key) return next(); // no protection configured

    const headerKey = req.headers['x-api-key'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    const queryKey = req.query && req.query.apiKey;

    if (headerKey === key || queryKey === key) return next();

    res.status(401).json({ error: 'Unauthorized - GUI API key required' });
  } catch (e) {
    // on unexpected error, deny access
    res.status(401).json({ error: 'Unauthorized' });
  }
};
