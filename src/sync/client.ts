// HTTP client for the self-hosted sync backend (see server/). Sync is keyed by
// a human-typable sync code; there are no accounts. The merge happens
// server-side (last-write-wins per collection by updatedAt).

export interface SyncCollectionDTO {
    id: string;
    name: string;
    counts: Record<string, number>;
    countsAt: Record<string, number>;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    locked: boolean;
    lockedAt: number;
}

// In dev, the Vite proxy forwards /api -> the local server. In production set
// VITE_SYNC_URL to the deployed server origin (e.g. https://sync.example.com).
const BASE = (import.meta.env.VITE_SYNC_URL ?? "").replace(/\/$/, "");

export class SyncError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        readonly code?: string
    ) {
        super(message);
        this.name = "SyncError";
    }
}

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

async function request<T>(path: string, init?: FetchInit): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}/api${path}`, {
            ...init,
            headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
        });
    } catch {
        throw new SyncError("network", undefined, "network");
    }
    if (!res.ok) {
        let code: string | undefined;
        try {
            code = (await res.json())?.error;
        } catch {
            /* ignore */
        }
        throw new SyncError(code ?? `http-${res.status}`, res.status, code);
    }
    return (await res.json()) as T;
}

export function createSyncCode(): Promise<{ code: string; collections: SyncCollectionDTO[] }> {
    return request("/sync/create", { method: "POST" });
}

export async function pullCollections(code: string): Promise<SyncCollectionDTO[]> {
    const data = await request<{ collections: SyncCollectionDTO[] }>(`/sync/${encodeURIComponent(code)}`);
    return data.collections;
}

export async function pushCollections(code: string, collections: SyncCollectionDTO[]): Promise<SyncCollectionDTO[]> {
    const data = await request<{ collections: SyncCollectionDTO[] }>(`/sync/${encodeURIComponent(code)}`, {
        method: "POST",
        body: JSON.stringify({ collections, clientId: getClientId() }),
    });
    return data.collections;
}

// A stable per-browser id so a device can ignore change events caused by its
// own pushes.
const CLIENT_ID_KEY = "wc2026-client-id";
export function getClientId(): string {
    let id: string | null = null;
    try {
        id = localStorage.getItem(CLIENT_ID_KEY);
    } catch {
        /* ignore */
    }
    if (!id) {
        id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        try {
            localStorage.setItem(CLIENT_ID_KEY, id);
        } catch {
            /* ignore */
        }
    }
    return id;
}

/**
 * Subscribe to change events for a sync code. Calls onChange whenever another
 * device updates the data. Returns a function that closes the stream. The
 * browser's EventSource reconnects automatically on transient errors.
 */
export function openEventStream(code: string, onChange: () => void): () => void {
    const url = `${BASE}/api/sync/${encodeURIComponent(code)}/events?clientId=${encodeURIComponent(getClientId())}`;
    const es = new EventSource(url);
    es.addEventListener("changed", () => onChange());
    return () => es.close();
}
