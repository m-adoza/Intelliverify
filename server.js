// ============================================================
// INTELLIVERIFY 2.0 — BACKEND ENTRY
// ============================================================
// Express app that:
//   • Serves the static frontend from /public
//   • Exposes JSON APIs under /api/*
//   • Owns all privileged operations (scans, status changes,
//     role changes, notifications, pairing)
//
// The browser never sees the service role key.
// ============================================================

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./lib/errors');

// ------------------------------------------------------------
// APP
// ------------------------------------------------------------

const app = express();

// Render sits behind a proxy. This makes req.ip and rate limiting
// behave correctly.
app.set('trust proxy', 1);

// ------------------------------------------------------------
// SECURITY HEADERS
// ------------------------------------------------------------
// CSP is disabled because the frontend loads Supabase, Google
// Fonts and Font Awesome from CDNs, and uses inline styles/scripts
// per the "one file per page" design.

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------
// Same-origin requests (frontend and backend on the same host)
// don't actually need CORS — the browser trusts itself. But
// modern browsers still send an Origin header for POSTs, so we
// must not reject them.
//
// Strategy:
//   • Requests with no Origin (curl, server-to-server) → allow
//   • Same-origin (Origin host matches request Host) → allow
//   • Configured FRONTEND_URL → allow
//   • localhost variants → allow
//   • any *.onrender.com → allow (dev convenience, same-tenant)
//   • anything else → no CORS headers (browser blocks it)

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // No origin → not a browser CORS request
    if (!origin) return next();

    // Same-origin check: compare Origin host to our Host header
    let isSameOrigin = false;
    try {
        const originHost = new URL(origin).host;
        const ourHost = req.headers.host;
        isSameOrigin = originHost === ourHost;
    } catch (_) { /* malformed origin */ }

    const isConfigured =
        allowedOrigins.includes(origin);

    const isRenderSubdomain =
        origin.endsWith('.onrender.com');

    const isLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    const allow =
        isSameOrigin ||
        isConfigured ||
        isRenderSubdomain ||
        isLocalhost;

    if (allow) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods',
            'GET, POST, PATCH, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers',
            'Content-Type, Authorization');
        res.setHeader('Vary', 'Origin');
    } else {
        console.warn('[CORS] Blocked origin:', origin);
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});
// ------------------------------------------------------------
// BODY PARSERS
// ------------------------------------------------------------
// 10MB limit for JSON so small payloads from the client work.
// File uploads go directly from the browser to Supabase Storage
// and are never sent through this server.

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ------------------------------------------------------------
// GLOBAL RATE LIMIT
// ------------------------------------------------------------
// Light throttle on all API routes. Specific routes (login,
// register, scan) get tighter limits inside their route files.

app.use('/api/', rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 120,                  // 120 requests / minute / IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' }
}));

// ------------------------------------------------------------
// STATIC FRONTEND
// ------------------------------------------------------------
// /public is the web root. Every HTML page, plus /assets/js/core.js,
// is served from here.

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// ------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------
// Both /health (for Render's healthCheckPath) and /api/health
// (for the frontend) are provided.

const healthPayload = () => ({
    status: 'online',
    version: require('./package.json').version,
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
});

app.get('/health', (req, res) => res.json(healthPayload()));
app.get('/api/health', (req, res) => res.json(healthPayload()));

// ------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------
// Mounted here. Each route file owns one resource.

app.use('/api/pairing',       require('./routes/pairing.routes'));
app.use('/api/reports',       require('./routes/reports.routes'));
app.use('/api/topics',        require('./routes/topics.routes'));
app.use('/api/corpus',        require('./routes/corpus.routes'));
app.use('/api/messages',      require('./routes/messages.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/admin',         require('./routes/admin.routes'));

// ------------------------------------------------------------
// API 404
// ------------------------------------------------------------
// Anything under /api/* that wasn't matched above returns JSON,
// not the HTML fallback.

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
});

// ------------------------------------------------------------
// FRONTEND FALLBACK
// ------------------------------------------------------------
// Serve /public/index.html for clean URLs like /student/dashboard.
// Requests for real files (with an extension) that don't exist
// return 404 instead of the landing page, so typos are visible.

app.get('*', (req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ------------------------------------------------------------
// CENTRAL ERROR HANDLER
// ------------------------------------------------------------
// Must be last. Catches anything thrown or passed via next(err).

app.use(errorHandler);

// ------------------------------------------------------------
// START
// ------------------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`IntelliVerify backend listening on port ${PORT}`);
    console.log(`Serving static files from ${PUBLIC_DIR}`);
    console.log(`Supabase URL: ${process.env.SUPABASE_URL || '(not set)'}`);
});

// ------------------------------------------------------------
// PROCESS-LEVEL SAFETY NETS
// ------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});
