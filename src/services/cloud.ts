import { apiFetch } from './apiClient';

export interface CloudBackup {
    id: string;
    user_id: string;
    data: string;
    created_at: number;
}

export interface BackupMeta {
    id: string;
    created_at: number;
    data_size: number;
}

/**
 * A failed cloud request, carrying the status so callers can tell the cases
 * apart. Every rejection used to be a bare Error, so a 429 (slow down, this
 * will work shortly), a 413 (this will never fit) and a dropped connection all
 * reached the user as one unexplained "failed to save to cloud".
 */
export class CloudRequestError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'CloudRequestError';
        this.status = status;
    }
}

export const cloudService = {
    /**
     * Store a new backup revision. Returns its id, which sync uses to recognise
     * its own write when it next checks whether the cloud moved under it — see
     * useCloudSync. `null` when the server didn't say, which callers must treat
     * as "the cloud may have moved" rather than as their own revision.
     */
    async save(token: string, data: any): Promise<string | null> {
        const res = await apiFetch('/api/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data })
        });
        if (!res.ok) throw new CloudRequestError('Failed to save', res.status);
        try {
            const body = await res.json() as { id?: string };
            return typeof body?.id === 'string' ? body.id : null;
        } catch { return null; }
    },

    // No `load()` that fetches every backup at once. Its endpoint is SELECT *,
    // so it shipped all ten retained bodies (2 MiB cap each) to callers that
    // only ever wanted the newest — which is what both callers did. Use
    // listMeta() to pick, then loadOne() to fetch that one.

    async listMeta(token: string): Promise<BackupMeta[]> {
        const res = await apiFetch('/api/content?meta=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new CloudRequestError('Failed to list backups', res.status);
        return await res.json() as BackupMeta[];
    },

    async loadOne(token: string, backupId: string): Promise<CloudBackup> {
        const res = await apiFetch(`/api/content/${encodeURIComponent(backupId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new CloudRequestError('Failed to load backup', res.status);
        return await res.json() as CloudBackup;
    },

    async deleteBackup(token: string, backupId: string): Promise<void> {
        const res = await apiFetch(`/api/content/${encodeURIComponent(backupId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new CloudRequestError('Failed to delete backup', res.status);
    }
};
