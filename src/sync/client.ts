// HTTP client for the self-hosted sync backend (see server/). Sync is keyed by
// a human-typable sync code; there are no accounts. The merge happens
// server-side (last-write-wins per collection by updatedAt).

export interface SyncCollectionDTO {
    id: string;
    name: string;
    counts: Record<string, number>;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
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
        body: JSON.stringify({ collections }),
    });
    return data.collections;
}
