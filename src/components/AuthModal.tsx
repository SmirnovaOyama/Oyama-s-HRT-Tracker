import React, { useRef, useState } from 'react';
import { X, Loader2, Fingerprint } from 'lucide-react';
import ShieldIcon from './ShieldIcon';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { authService, serializeAssertionCredential, b64url2ab, AuthResponse } from '../services/auth';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [needsTOTP, setNeedsTOTP] = useState(false);
    const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'passkey' | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [backupCode, setBackupCode] = useState('');
    const [passkeyLoading, setPasskeyLoading] = useState(false);

    /**
     * The credential the server accepted, frozen at the moment it accepted it.
     *
     * This is what the cloud key gets derived from on the passkey second-factor
     * path, and it deliberately does not read the live form state. Two reasons,
     * both of which produce a wrong key rather than no key:
     *
     *   - The password and username inputs stay mounted and editable through
     *     the whole second-factor step, and a password manager is as likely to
     *     re-fill them as the user is to retype. Only the value the server
     *     actually checked may be used.
     *   - The passkey step can be entered by a deferred call (see the
     *     `needs2FA` branch below, which auto-starts the WebAuthn prompt), and
     *     that call runs a closure from the render *before* the state flag was
     *     set. A ref is read when it fires, so it sees the credential; the flag
     *     it replaced was still false there, and silently skipped the derive.
     *
     * Null whenever no password has been verified in this form's lifetime.
     */
    const verifiedRef = useRef<{ username: string; password: string } | null>(null);

    const { login, register, loginWithToken } = useAuth();
    const { t } = useTranslation();

    if (!isOpen) return null;

    /** The password to derive this device's cloud key from, or nothing. */
    const verifiedPasswordFor = (result: AuthResponse): string | undefined => {
        const verified = verifiedRef.current;
        // The account the passkey resolved to has to be the one the password
        // was checked against: the key's salt is the user id, so a mismatch
        // would derive one account's key out of another's password.
        return verified && result.user.username === verified.username
            ? verified.password
            : undefined;
    };

    const handlePasskeyLogin = async () => {
        if (!window.PublicKeyCredential) {
            setError(t('auth.passkey_unsupported'));
            return;
        }
        setPasskeyLoading(true);
        setError(null);
        try {
            const opts = await authService.passkeyAuthOptions(username || undefined);
            const credential = await navigator.credentials.get({
                publicKey: {
                    rpId: window.location.hostname,
                    challenge: b64url2ab(opts.challenge),
                    allowCredentials: opts.credentialIds.map(id => ({
                        type: 'public-key' as const,
                        id: b64url2ab(id),
                    })),
                    timeout: 60000,
                    userVerification: 'preferred',
                },
            }) as PublicKeyCredential | null;
            if (!credential) return;
            const result = await authService.passkeyAuthVerify(opts.challengeToken, serializeAssertionCredential(credential));
            // Nothing when the passkey *is* the whole sign-in: no password was
            // ever seen, so no key can be derived, and the Account page's
            // unlock row is the way in. Something when it was the second factor
            // after one the server accepted — see `verifiedRef`.
            await loginWithToken(result, verifiedPasswordFor(result));
            onClose();
        } catch (e: any) {
            if (e.name !== 'NotAllowedError') {
                setError(e.message || t('auth.passkey_failed'));
            }
        } finally {
            setPasskeyLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isLogin) {
                await login(
                    username, password,
                    needsTOTP && twoFAMethod === 'totp' && !useBackupCode ? totpCode : undefined,
                    needsTOTP && useBackupCode ? backupCode : undefined,
                );
            } else {
                await register(username, password);
                onClose();
                // needsSetup2FA redirect is handled by App.tsx
                return;
            }
            onClose();
            setUsername('');
            setPassword('');
            setNeedsTOTP(false);
            setTwoFAMethod(null);
            setTotpCode('');
            setUseBackupCode(false);
            setBackupCode('');
            // This component is never unmounted, only hidden, so a credential
            // left here would still be sitting in the ref the next time the
            // modal opens — by which point the password may have changed
            // elsewhere.
            verifiedRef.current = null;
        } catch (err: any) {
            if (err.needs2FA) {
                const method: 'totp' | 'passkey' = err.method ?? 'totp';
                // Reaching here means the server checked this password and was
                // satisfied — /api/login only answers needs2FA after the bcrypt
                // compare passes. Freeze it now; the form is still editable.
                verifiedRef.current = { username, password };
                setNeedsTOTP(true);
                setTwoFAMethod(method);
                setError(null);
                if (method === 'passkey') {
                    setTimeout(() => handlePasskeyLogin(), 100);
                }
            } else {
                setError(err.message || t('error.generic'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-shell">
            <div className="modal-card overflow-hidden p-0">
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <h2 className="modal-title mb-0">
                        {isLogin ? t('auth.sign_in') : t('auth.sign_up')}
                    </h2>
                    <button onClick={onClose} className="p-1 text-muted hover:text-body">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 pb-5 pt-1 space-y-3">
                    {error && (
                        <div className="p-2.5 text-xs text-red-600 dark:text-red-400 callout border-red-200 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-sm text-muted">{t('auth.username')}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-base"
                            placeholder={t('auth.username_placeholder')}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm text-muted">{t('auth.password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-base"
                            placeholder={t('auth.password_placeholder')}
                            required
                        />
                    </div>

                    {needsTOTP && isLogin && (
                        <div className="space-y-3">
                            <div className="callout flex items-center gap-2 text-xs">
                                <ShieldIcon size={16} className="shrink-0 text-[var(--color-m3-primary)] dark:text-[var(--color-m3-primary-light)]" />
                                {t('auth.needs_2fa')}
                            </div>
                            {useBackupCode ? (
                                <div className="space-y-2">
                                    <label className="text-sm text-muted">{t('auth.backup_code_label')}</label>
                                    <input
                                        type="text"
                                        value={backupCode}
                                        onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                                        className="input-base font-mono text-center tracking-widest"
                                        placeholder={t('auth.backup_code_placeholder')}
                                        autoComplete="off"
                                        autoFocus
                                        required={useBackupCode}
                                    />
                                    <button type="button" onClick={() => { setUseBackupCode(false); setBackupCode(''); }}
                                        className="text-xs text-[var(--color-m3-primary)] hover:underline">
                                        ← {twoFAMethod === 'totp' ? t('auth.totp_code') : t('auth.passkey_as_2fa')}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {twoFAMethod !== 'passkey' && (
                                        <div className="space-y-1.5">
                                            <label className="text-sm text-muted">{t('auth.totp_code')}</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]{6}"
                                                maxLength={6}
                                                value={totpCode}
                                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="input-base font-mono text-center tracking-widest"
                                                placeholder={t('auth.totp_placeholder')}
                                                autoComplete="one-time-code"
                                                autoFocus
                                                required={needsTOTP && !useBackupCode}
                                            />
                                        </div>
                                    )}
                                    {twoFAMethod === 'passkey' && typeof window !== 'undefined' && !window.PublicKeyCredential && (
                                        <p className="text-xs text-red-500 text-center">{t('auth.passkey_unsupported')}</p>
                                    )}
                                    {typeof window !== 'undefined' && !!window.PublicKeyCredential && (
                                        <>
                                            {twoFAMethod !== 'passkey' && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-px bg-[var(--color-m3-outline-variant)] dark:bg-[var(--color-m3-dark-outline-variant)]" />
                                                    <span className="text-xs text-muted">{t('common.or')}</span>
                                                    <div className="flex-1 h-px bg-[var(--color-m3-outline-variant)] dark:bg-[var(--color-m3-dark-outline-variant)]" />
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handlePasskeyLogin}
                                                disabled={passkeyLoading}
                                                className="btn-secondary w-full"
                                            >
                                                {passkeyLoading ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                                                {t('auth.passkey_as_2fa')}
                                            </button>
                                        </>
                                    )}
                                    <button type="button" onClick={() => setUseBackupCode(true)}
                                        className="w-full text-xs text-muted hover:text-body text-center py-1">
                                        {t('auth.use_backup_code')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {!(needsTOTP && twoFAMethod === 'passkey' && !useBackupCode) && (
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full mt-1"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {isLogin ? t('auth.sign_in') : t('auth.sign_up')}
                    </button>
                    )}

                    <div className="pt-2 text-center text-sm text-muted">
                        {isLogin ? t('auth.no_account') : t('auth.has_account')}{' '}
                        <button
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setError(null); verifiedRef.current = null; }}
                            className="text-[var(--color-m3-primary)] dark:text-[var(--color-m3-primary-light)] hover:underline"
                        >
                            {isLogin ? t('auth.go_register') : t('auth.go_login')}
                        </button>
                    </div>
                </form>
            </div>
            </div>
        </div>
    );
};

export default AuthModal;
