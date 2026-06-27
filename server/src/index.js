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
    const now = Date.now();
    const createdAt = Number.isFinite(c.createdAt) ? c.createdAt : now;
    const updatedAt = Number.isFinite(c.updatedAt) ? c.updatedAt : now;
    const deletedAt = Number.isFinite(c.deletedAt) ? c.deletedAt : null;
    return { id: c.id.slice(0, 64), name, counts, createdAt, updatedAt, deletedAt };
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

// Pull all collections for a code (device B after pairing).
app.get("/api/sync/:code", (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!CODE_RE.test(code)) return res.status(400).json({ error: "invalid-code" });
    if (!codeExists(code)) return res.status(404).json({ error: "unknown-code" });
    res.json({ code, collections: getCollections(code) });
});

// Push local collections; server merges (last-write-wins per id) and returns the
// merged set so the caller can adopt it.
app.post("/api/sync/:code", (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!CODE_RE.test(code)) return res.status(400).json({ error: "invalid-code" });
    if (!codeExists(code)) return res.status(404).json({ error: "unknown-code" });

    const incoming = Array.isArray(req.body?.collections) ? req.body.collections : [];
    const sanitized = incoming.map(sanitizeCollection).filter(Boolean);
    const merged = mergeCollections(code, sanitized);
    res.json({ code, collections: merged });
});

app.listen(PORT, () => {
    console.log(`Sticker sync server listening on http://localhost:${PORT}`);
});
