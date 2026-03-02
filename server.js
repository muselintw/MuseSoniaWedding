require('dotenv').config();
const http = require('http');
const express = require('express');
const path = require('path');
const { middleware, handleEvent } = require('./lineBot');
const pushRouter = require('./pushService');
const supabase = require('./supabaseClient');

const app = express();
// Zeabur injects PORT automatically — do NOT set it as an env var in Zeabur dashboard
const port = parseInt(process.env.PORT, 10) || 3000;

// ── Request logging ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static admin pages ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── LINE Webhook ─────────────────────────────────────────────────────────────
// LINE middleware must come BEFORE body-parser for signature verification
app.post('/webhook', middleware, (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error('Webhook error:', err);
            res.status(500).end();
        });
});

// ── JSON / URL-encoded body parser (for non-webhook routes) ──────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Push API ─────────────────────────────────────────────────────────────────
app.use('/api', pushRouter);

// ── Friends list API ──────────────────────────────────────────────────────────
app.get('/api/friends', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('joined_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, count: data.length, friends: data });
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friends/csv', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('joined_at', { ascending: false });

        if (error) throw error;

        const header = 'line_uid,display_name,joined_at\n';
        const rows = data
            .map(u => `${u.line_uid},"${(u.display_name || '').replace(/"/g, '""')}",${u.joined_at}`)
            .join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=friends.csv');
        // BOM for Excel CJK support
        res.send('\uFEFF' + header + rows);
    } catch (err) {
        console.error('Error exporting CSV:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Start server ─────────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so Zeabur's gateway can reach the container
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${port}`);
});
