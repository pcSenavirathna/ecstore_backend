const WINDOW_MS = 15 * 60 * 1000;

// A small in-memory limiter keeps the API safe without adding infrastructure.
// Use Redis (or the hosting provider's limiter) when running more than one API instance.
const createRateLimiter = ({ limit, windowMs = WINDOW_MS, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const record = hits.get(key);
    const active = record && record.resetAt > now ? record : { count: 0, resetAt: now + windowMs };
    active.count += 1;
    hits.set(key, active);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - active.count)));
    if (active.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((active.resetAt - now) / 1000)));
      return res.status(429).json({ message: message || 'Too many requests. Please try again later.' });
    }
    return next();
  };
};

const securityHeaders = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

module.exports = { createRateLimiter, securityHeaders };
