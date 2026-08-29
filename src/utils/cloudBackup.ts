import { decryptCloudPayload, isCloudEncrypted, deriveCloudKey, encryptCloudPayload } from '../../logic';

/**
 * Fired when this device gains (or changes) the key that decrypts cloud
 * backups. Sync is suspended while a backup is readable only in principle, so
 * it needs to know the moment that stops being true — otherwise unlocking on
 * the Account page leaves sync idle until the next scheduled poll.
 */
export const CLOUD_KEY_CHANGED_EVENT = 'hrt-cloud-key-changed';

function announceKeyChange(): void {
    try { window.dispatchEvent(new Event(CLOUD_KEY_CHANGED_EVENT)); } catch { /* non-DOM host */ }
}

/**
 * Where the derived key lives. One slot, holding the key *and* the account it
 * belongs to.
 *
 * It used to hold the key alone, which made "this device has a key" and "this
 * device has a key for the account currently signed in" the same question. They
 * are not: every write path derives from the signed-in user's id, but nothing
 * in the read path checked whose key came back, so the invariant rested
 * entirely on sign-out having cleared it first. Recording the owner makes the
 * check local instead of a chain of reasoning about other code.
 */
const KEY_SLOT = 'enc_key';

interface StoredCloudKey {
    /** Account id the key was derived for. */
    u: string;
    /** Raw AES key bytes, base64. */
    k: string;
}

function readSlot(): StoredCloudKey | null {
    const raw = localStorage.getItem(KEY_SLOT);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.u === 'string' && typeof parsed.k === 'string') {
            return parsed as StoredCloudKey;
        }
    } catch { /* not the envelope — see below */ }
    return null;
}

/**
 * The key this device holds for `userId`, or null.
 *
 * A slot written by an older build holds the bare key with no owner. Only one
 * account can be signed in at a time and signing out clears the slot, so
 * whoever is asking is the account it was derived for: adopt it rather than
 * making every existing user re-enter their password on the next release.
 */
function readCloudKey(userId: string): string | null {
    const stored = readSlot();
    if (stored) return stored.u === userId ? stored.k : null;

    const legacy = localStorage.getItem(KEY_SLOT);
    if (!legacy) return null;
    localStorage.setItem(KEY_SLOT, JSON.stringify({ u: userId, k: legacy }));
    return legacy;
}

/** Cache a derived cloud key on this device and wake anything waiting on one. */
export function cacheCloudKey(userId: string, rawKeyB64: string | null): void {
    if (rawKeyB64) localStorage.setItem(KEY_SLOT, JSON.stringify({ u: userId, k: rawKeyB64 }));
    else localStorage.removeItem(KEY_SLOT);
    announceKeyChange();
}

/**
 * Drop whatever key is held, whoever it belongs to. Sign-out, and the forced
 * sign-out a dead session triggers.
 */
export function clearCloudKey(): void {
    localStorage.removeItem(KEY_SLOT);
    announceKeyChange();
}

/**
 * Whether this device holds a key for this account — distinct from holding the
 * right one, which only trying it against real ciphertext can answer.
 */
export function hasCloudKey(userId: string): boolean {
    return readCloudKey(userId) !== null;
}

/**
 * Encrypt an export payload for cloud storage. Throws when this device holds no
 * key, rather than uploading the record in the clear.
 *
 * Returning the payload as-is was a silent downgrade: on a passwordless passkey
 * login, or on a non-secure origin where `deriveCloudKey` cannot run at all, no
 * key is ever cached — so the full dose/lab history went to the server as
 * plaintext JSON while the UI reported a successful sync. The read path already
 * refuses to act without a key (`locked`); the write path has to fail the same
 * way. Callers gate on `hasCloudKey()` and surface `locked` instead.
 */
export async function prepareCloudPayload(exportData: any, userId: string): Promise<any> {
    const key = readCloudKey(userId);
    if (!key) throw new Error('CLOUD_KEY_MISSING');
    return await encryptCloudPayload(JSON.stringify(exportData), key);
}

export interface BackupSummary {
    events: any[];
    labResults: any[];
    doseTemplates: any[];
    weight?: number;
}

// Outcome of trying to read a cloud backup:
//  - ok:      decrypted (or plaintext) and ready to use
//  - corrupt: not valid JSON / unexpected shape
//  - locked:  encrypted, but this device has no working key (e.g. signed in
//             with a passkey, or the key was cleared) — the user must unlock
//             with their password.
export type CloudBackupResult =
    | { status: 'ok'; data: any }
    | { status: 'corrupt' }
    | { status: 'locked' };

function toEnvelope(rawData: string | unknown): any | undefined {
    try {
        return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch {
        return undefined;
    }
}

/** Read a stored cloud backup, decrypting with the cached device key if needed. */
export async function readCloudBackup(rawData: string | unknown, userId: string): Promise<CloudBackupResult> {
    const parsed = toEnvelope(rawData);
    if (parsed === undefined) return { status: 'corrupt' };
    if (!isCloudEncrypted(parsed)) return { status: 'ok', data: parsed };

    const key = readCloudKey(userId);
    if (key) {
        const plain = await decryptCloudPayload(parsed, key);
        if (plain !== null) {
            try { return { status: 'ok', data: JSON.parse(plain) }; }
            catch { return { status: 'corrupt' }; }
        }
    }
    return { status: 'locked' };
}

/**
 * Verify a password against an encrypted backup and, on success, cache the
 * derived key so every other backup decrypts too. Returns `locked` when the
 * password is wrong (or the backup was encrypted under a different/old
 * password). The key is only cached once it has actually decrypted the bundle,
 * so a bad password never poisons future saves.
 */
export async function unlockCloudBackup(
    rawData: string | unknown,
    password: string,
    userId: string,
): Promise<CloudBackupResult> {
    const parsed = toEnvelope(rawData);
    if (parsed === undefined) return { status: 'corrupt' };
    if (!isCloudEncrypted(parsed)) return { status: 'ok', data: parsed };

    let candidate: string;
    try { candidate = await deriveCloudKey(password, userId); }
    catch { return { status: 'locked' }; }

    const plain = await decryptCloudPayload(parsed, candidate);
    if (plain === null) return { status: 'locked' };

    cacheCloudKey(userId, candidate);
    try { return { status: 'ok', data: JSON.parse(plain) }; }
    catch { return { status: 'corrupt' }; }
}

export type CloudKeyResult =
    /** A key is now cached on this device; sync can read and write again. */
    | 'unlocked'
    /** There is ciphertext up there and this password does not open it. */
    | 'wrong-password'
    /** No SubtleCrypto here — a non-secure origin. No password can help. */
    | 'unsupported';

/**
 * Give this device the key for the account's cloud backups, from the account
 * password.
 *
 * `revisions` yields the raw stored bodies of the account's revisions, newest
 * first. It is walked lazily and abandoned at the first one the derived key
 * opens, so the common case costs a single fetch — but when nothing opens, it
 * has to be walked to the end. Anything short of that decides "this account
 * holds no ciphertext" from a sample, and the caller cannot tell a plaintext
 * revision sitting on top of encrypted history from an account that has none.
 *
 * The key is cached only once it has actually opened a revision, so a mistyped
 * password cannot leave the device encrypting under a key nothing else in the
 * account shares.
 *
 * When the account holds no ciphertext at all — the status this unlocks turns
 * on this device holding no key, not on what is stored, so an empty cloud
 * reaches it — there is nothing here to check against and `confirmPassword`
 * decides. That is the account password endpoint, which is the only other
 * thing that knows. Refusing outright would be a dead end, and accepting
 * blindly was worse than it looked: it is precisely the account with nothing
 * encrypted yet whose *first* backup would be written under a typo'd key that
 * no other device could ever open.
 *
 * `confirmPassword` may throw — it is a network call — and the throw is passed
 * through rather than swallowed into "wrong password", so the caller can tell
 * "we could not ask" from "we asked and it is wrong". Nothing is cached on
 * either.
 *
 * This is the way back from `locked` for a device that signed in with a passkey
 * alone: no password was ever seen, so no key could be derived at sign-in.
 */
export async function establishCloudKey(
    password: string,
    userId: string,
    revisions: AsyncIterable<string | unknown> | Iterable<string | unknown>,
    confirmPassword: (password: string) => Promise<boolean>,
): Promise<CloudKeyResult> {
    let candidate: string;
    try { candidate = await deriveCloudKey(password, userId); }
    catch { return 'unsupported'; }

    let sawEncrypted = false;
    for await (const raw of revisions) {
        const parsed = toEnvelope(raw);
        // A body that isn't JSON is a truncated write, and says nothing about
        // the ones under it. Keep looking rather than concluding the account
        // holds no ciphertext.
        if (parsed === undefined || !isCloudEncrypted(parsed)) continue;
        sawEncrypted = true;
        if (await decryptCloudPayload(parsed, candidate) !== null) {
            cacheCloudKey(userId, candidate);
            return 'unlocked';
        }
    }

    // Ciphertext that this password does not open. The server cannot help
    // here and asking it would give the wrong answer: backups written under a
    // previous password are opened by that password, not the current one.
    if (sawEncrypted) return 'wrong-password';

    if (!(await confirmPassword(password))) return 'wrong-password';
    cacheCloudKey(userId, candidate);
    return 'unlocked';
}


/** Flatten v1/v2 backup payloads into counts usable by the account UI. */
export function normalizeBackupPayload(parsed: any): BackupSummary {
    if (!parsed || typeof parsed !== 'object') {
        return { events: [], labResults: [], doseTemplates: [] };
    }

    if (parsed.modes && typeof parsed.modes === 'object') {
        const modesBlock = parsed.modes as Record<string, any>;
        const preferredMode = localStorage.getItem('hrt-mode') === 'transmasc' ? 'transmasc' : 'transfem';
        const preferredBlock = modesBlock[preferredMode];

        if (preferredBlock && typeof preferredBlock === 'object') {
            return {
                events: Array.isArray(preferredBlock.events) ? preferredBlock.events : [],
                labResults: Array.isArray(preferredBlock.labResults) ? preferredBlock.labResults : [],
                doseTemplates: Array.isArray(preferredBlock.doseTemplates) ? preferredBlock.doseTemplates : [],
                weight: typeof parsed.weight === 'number' ? parsed.weight : undefined,
            };
        }

        const events: any[] = [];
        const labResults: any[] = [];
        const doseTemplates: any[] = [];
        for (const mode of ['transfem', 'transmasc'] as const) {
            const block = modesBlock[mode];
            if (!block || typeof block !== 'object') continue;
            if (Array.isArray(block.events)) events.push(...block.events);
            if (Array.isArray(block.labResults)) labResults.push(...block.labResults);
            if (Array.isArray(block.doseTemplates)) doseTemplates.push(...block.doseTemplates);
        }
        return {
            events,
            labResults,
            doseTemplates,
            weight: typeof parsed.weight === 'number' ? parsed.weight : undefined,
        };
    }

    return {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        labResults: Array.isArray(parsed.labResults) ? parsed.labResults : [],
        doseTemplates: Array.isArray(parsed.doseTemplates) ? parsed.doseTemplates : [],
        weight: typeof parsed.weight === 'number' ? parsed.weight : undefined,
    };
}
