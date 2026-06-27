import express from "express";
import cors from "cors";
import { codeExists, createCode, getCollections, mergeCollections } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT) || 8787;

// Unambiguous alphabet (no 0/O/1/I) for human-typable sync codes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

function randomCode() {
    const group = () =>
        Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    return `${group()}-${group()}-${group()}`;
}

function normalizeCode(raw) {
    return String(raw || "")
        .toUpperCase()
        .trim();
}

/** Coerce an untrusted client collection into a safe, stored shape. */
function sanitizeCollection(c) {
    if (!c || typeof c !== "object") return null;
    if (typeof c.id !== "string" || !c.id) return null;
    const name = typeof c.name === "string" ? c.name.slice(0, 120) : "Collection";
    const counts = {};
    if (c.counts && typeof c.counts === "object" && !Array.isArray(c.counts)) {
        for (const [code, n] of Object.entries(c.counts)) {
            const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
            if (v > 0) counts[code] = v;
        }
    }
    const countsAt = {};
    if (c.countsAt && typeof c.countsAt === "object" && !Array.isArray(c.countsAt)) {
        for (const [code, t] of Object.entries(c.countsAt)) {
            if (typeof t === "number" && Number.isFinite(t) && t > 0) countsAt[code] = Math.floor(t);
        }
    }
    const now = Date.now();
    const createdAt = Number.isFinite(c.createdAt) ? c.createdAt : now;
    const updatedAt = Number.isFinite(c.updatedAt) ? c.updatedAt : now;
    const deletedAt = Number.isFinite(c.deletedAt) ? c.deletedAt : null;
    const locked = !!c.locked;
    const lockedAt = Number.isFinite(c.lockedAt) ? c.lockedAt : 0;
    return { id: c.id.slice(0, 64), name, counts, countsAt, createdAt, updatedAt, deletedAt, locked, lockedAt };
}

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

// Create a fresh sync code (device A "enable sync").
app.post("/api/sync/create", (_req, res) => {
    let code = randomCode();
    let guard = 0;
    while (codeExists(code) && guard++ < 10) code = randomCode();
    createCode(code);
    res.json({ code, collections: [] });
});

// Open SSE streams per sync code: code -> Set<{ res, clientId }>.
const streams = new Map();

// Notify every device on a code (except the originator) that data changed, so
// they can pull. Only called when a merge actually wrote something.
function broadcastChange(code, sourceClientId) {
    const set = streams.get(code);
    if (!set) return;
    const payload = `event: changed\ndata: ${JSON.stringify({ source: sourceClientId, at: Date.now() })}\n\n`;
    for (const client of set) {
        if (sourceClientId && client.clientId === sourceClientId) continue;
        client.res.write(payload);
    }
}

// Pull all collections for a code (device B after pairing).
app.get("/api/sync/:code", (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!CODE_RE.test(code)) return res.status(400).json({ error: "invalid-code" });
    if (!codeExists(code)) return res.status(404).json({ error: "unknown-code" });
    res.json({ code, collections: getCollections(code) });
});

// Server-Sent Events stream: clients subscribe here and get a "changed" event
// whenever another device updates this code's data.
app.get("/api/sync/:code/events", (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!CODE_RE.test(code)) return res.status(400).end();
    if (!codeExists(code)) return res.status(404).end();

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // disable proxy buffering (nginx)
    });
    res.write("retry: 3000\n: connected\n\n");

    let set = streams.get(code);
    if (!set) {
        set = new Set();
        streams.set(code, set);
    }
    const client = { res, clientId: String(req.query.clientId || "") };
    set.add(client);

    // Keep the connection alive through idle-timeout proxies.
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        set.delete(client);
        if (set.size === 0) streams.delete(code);
    });
});

// Push local collections; server merges (last-write-wins per id) and returns the
// merged set so the caller can adopt it. Notifies other devices on change.
app.post("/api/sync/:code", (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!CODE_RE.test(code)) return res.status(400).json({ error: "invalid-code" });
    if (!codeExists(code)) return res.status(404).json({ error: "unknown-code" });

    const incoming = Array.isArray(req.body?.collections) ? req.body.collections : [];
    const sanitized = incoming.map(sanitizeCollection).filter(Boolean);
    const { collections, changed } = mergeCollections(code, sanitized);
    if (changed) broadcastChange(code, String(req.body?.clientId || ""));
    res.json({ code, collections });
});

app.listen(PORT, () => {
    console.log(`Sticker sync server listening on http://localhost:${PORT}`);
});
