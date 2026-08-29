import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authService, User, AuthResponse, sessionIdFromToken } from '../services/auth';
import { deriveCloudKey } from '../../logic';
import { cacheCloudKey, clearCloudKey } from '../utils/cloudBackup';
import { UNAUTHORIZED_EVENT } from '../services/apiClient';
import { useDialog } from './DialogContext';
import { useTranslation } from './LanguageContext';

// Derive and cache the cloud-backup encryption key for this device. The key
// is derived from the password (which only the client ever sees) so the
// server/admin can never decrypt backups. Cached as raw bytes — it can decrypt
// data but cannot be used to authenticate.
async function setCloudKey(password: string, userId: string): Promise<void> {
    try {
        cacheCloudKey(userId, await deriveCloudKey(password, userId));
    } catch {
        // Derivation only fails where there is no SubtleCrypto to do it with —
        // a non-secure origin, i.e. a self-hosted deploy without TLS.
        //
        // Clearing the key rather than keeping a stale one is deliberate, and
        // it no longer means what the comment here used to say ("saves stay
        // plaintext"): prepareCloudPayload throws without a key and sync
        // reports `locked`, so the account is unreachable rather than silently
        // uploaded in the clear. Unreachable is the right end of that trade for
        // health data, and the Account page says which state it is in.
        clearCloudKey();
    }
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string, totpCode?: string, backupCode?: string) => Promise<void>;
    /**
     * Finish a sign-in the server has already granted a token for.
     *
     * `verifiedPassword` is the account password *the server just accepted* —
     * pass it only from the second step of a password sign-in, never from a
     * password box the user typed into but never submitted. It is what the
     * cloud key is derived from, so a wrong value would cache a key that
     * opens nothing.
     */
    loginWithToken: (data: AuthResponse, verifiedPassword?: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    updateProfile: (username: string) => Promise<void>;
    changePassword: (current: string, newPass: string) => Promise<void>;
    deleteAccount: (password: string, code?: string, backupCode?: string) => Promise<void>;
    needsSetup2FA: boolean;
    clearSetup2FA: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showDialog } = useDialog();
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
    const [isLoading, setIsLoading] = useState(true);
    const [needsSetup2FA, setNeedsSetup2FA] = useState(() => localStorage.getItem('needs_setup_2fa') === 'true');

    // Clear any stale forced-2FA flag persisted from previous app versions —
    // 2FA setup is now optional, never forced.
    useEffect(() => {
        if (localStorage.getItem('needs_setup_2fa') === 'true') {
            localStorage.removeItem('needs_setup_2fa');
            setNeedsSetup2FA(false);
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('auth_user');
        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user", e);
                // The token itself is still live, so revoke it server-side.
                void logout();
            }
        }
        setIsLoading(false);
    }, [token]);

    const login = async (username: string, password: string, totpCode?: string, backupCode?: string) => {
        const data = await authService.login(username, password, totpCode, backupCode);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        await setCloudKey(password, data.user.id);
        if (data.needsSetup2FA) {
            setNeedsSetup2FA(true);
            localStorage.setItem('needs_setup_2fa', 'true');
        } else {
            setNeedsSetup2FA(false);
            localStorage.removeItem('needs_setup_2fa');
        }
    };

    // Used by both passkey paths: a passkey *as the whole sign-in*, and a
    // passkey used as the second factor after a password.
    //
    // The second of those used to land here with the password in hand and drop
    // it, which is why an account with a passkey second factor ended up on a
    // device that had never derived a cloud key: sync could then only report
    // `locked`, and the manual backup button could only fail. Derive it here
    // when the caller has a password the server accepted, so the passkey
    // branch of a password sign-in ends up in the same state as the TOTP one.
    //
    // Passkey-only sign-in still has no password to derive from — nothing can
    // change that — so it stays keyless until the user unlocks on the Account
    // page.
    const loginWithToken = async (data: AuthResponse, verifiedPassword?: string) => {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        // Passkey login always counts as completing 2FA
        setNeedsSetup2FA(false);
        localStorage.removeItem('needs_setup_2fa');
        if (verifiedPassword) await setCloudKey(verifiedPassword, data.user.id);
    };

    const register = async (username: string, password: string) => {
        const data = await authService.register(username, password);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        await setCloudKey(password, data.user.id);
        // 2FA setup is optional — do not force new users into setup flow.
        setNeedsSetup2FA(false);
        localStorage.removeItem('needs_setup_2fa');
    };

    const clearSetup2FA = () => {
        setNeedsSetup2FA(false);
        localStorage.removeItem('needs_setup_2fa');
    };

    // Clear this device's copy of the session. Split out so the forced sign-out
    // below can reuse it without trying to revoke a session the server has
    // already destroyed.
    const clearLocalSession = () => {
        setToken(null);
        setUser(null);
        setNeedsSetup2FA(false);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('needs_setup_2fa');
        clearCloudKey();
    };

    const logout = async () => {
        // Signing out is the one action a user takes precisely because they want
        // the credential to stop working, and it used to be local-only: the
        // session row survived, so the 7-day JWT kept passing the worker's
        // middleware and every request refreshed last_used_at, meaning the idle
        // timeout never fired either. Anyone who had copied the token out of
        // localStorage kept the account for a week. Best effort — a failed
        // request must never trap the user in a signed-in UI.
        const currentToken = localStorage.getItem('auth_token');
        const sid = sessionIdFromToken(currentToken);
        if (currentToken && sid) {
            try { await authService.terminateSession(currentToken, sid); } catch { /* revoke is best-effort */ }
        }
        clearLocalSession();
    };

    // When the server reports the session is no longer valid, drop the stale
    // session and tell the user to sign in again — rather than leaving them on
    // a "logged-in" screen where every cloud request silently 401s. A ref keeps
    // the listener stable while always running the latest closure (current
    // language, latest logout).
    const onUnauthorizedRef = useRef<() => void>(() => {});
    onUnauthorizedRef.current = () => {
        // Already signed out — ignore so several concurrent 401s don't stack
        // multiple prompts.
        if (!localStorage.getItem('auth_token')) return;
        // The worker only sends X-Session-Invalid once the row is already gone,
        // so there is nothing left to revoke — just drop the local copy.
        clearLocalSession();
        showDialog('alert', t('auth.session_expired'));
    };
    useEffect(() => {
        const handler = () => onUnauthorizedRef.current();
        window.addEventListener(UNAUTHORIZED_EVENT, handler);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
    }, []);

    const updateProfile = async (username: string) => {
        if (!token) return;
        const data = await authService.updateProfile(token, username);
        const updatedUser = { ...user!, username: data.username };
        setUser(updatedUser);
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    };

    const changePassword = async (current: string, newPass: string) => {
        if (!token) return;
        await authService.changePassword(token, current, newPass);
        // Re-derive the cloud key for the new password. Backups made under the
        // old password become unreadable (this is what also stops an admin who
        // resets the password from decrypting them).
        if (user) await setCloudKey(newPass, user.id);
    };

    const deleteAccount = async (password: string, code?: string, backupCode?: string) => {
        if (!token) return;
        await authService.deleteAccount(token, password, code, backupCode);
        // The account delete already dropped every sessions row for this user.
        clearLocalSession();
    };

    return (
        <AuthContext.Provider value={{ user, token, login, loginWithToken, register, logout, isLoading, updateProfile, changePassword, deleteAccount, needsSetup2FA, clearSetup2FA }}>
            {children}
        </AuthContext.Provider>
    );
};
