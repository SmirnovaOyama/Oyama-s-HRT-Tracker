import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Loader2, Check,
    AlertCircle, Eye, EyeOff, Copy, Fingerprint, X, Plus,
    KeyRound, Download, RefreshCw,
} from 'lucide-react';
import ShieldIcon from '../components/ShieldIcon';
import { QRCodeSVG } from 'qrcode.react';
import {
    authService, Passkey,
    serializeAttestationCredential, b64url2ab,
} from '../services/auth';
import { useTranslation } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import PasswordInputModal from '../components/PasswordInputModal';
import { SettingsIconBox, settingsMuted, settingsOn } from '../components/SettingsListItem';

interface TwoFactorPageProps {
    token: string;
    /** Combined status (TOTP *or* passkey) as the parent last saw it. */
    enabled: boolean;
    onStatusChange: (enabled: boolean) => void;
    onBack: () => void;
    setupRequired?: boolean;
}

/**
 * Which sensitive action a password prompt is standing in front of. Both
 * endpoints behind these destroy a recovery path, so the server demands the
 * account password; sending the request without one just earns a 400.
 */
type PasswordPrompt =
    | { kind: 'delete-passkey'; passkey: Passkey }
    | { kind: 'regenerate-backup-codes' };

type SetupStep = 'scan' | 'verify';
type ActiveTab = 'totp' | 'passkey';

function detectDeviceName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (ua.includes('Mac OS X')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    return 'Unknown device';
}

const divider = "border-b border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)]";
const muted = settingsMuted;
const on = settingsOn;
const inputCls = "w-full px-3 py-2.5 text-sm bg-[var(--color-m3-surface-container-lowest)] dark:bg-[var(--color-m3-dark-surface-container-low)] border border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)] rounded-md focus:outline-none focus:border-[var(--color-m3-primary)] text-[var(--color-m3-on-surface)] dark:text-[var(--color-m3-dark-on-surface)]";
const labelCls = `block text-xs font-semibold ${muted} mb-1`;
const primaryBtn = "w-full py-2.5 bg-[var(--color-m3-primary)] hover:bg-[var(--color-m3-primary-light)] text-white text-sm font-medium rounded-md disabled:opacity-40 flex items-center justify-center gap-2 transition-colors";

const ErrLine: React.FC<{ msg: string | null }> = ({ msg }) =>
    msg ? (
        <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
            <AlertCircle size={13} className="shrink-0" />{msg}
        </p>
    ) : null;

const BackupCodesBlock: React.FC<{
    codes: string[];
    copied: boolean;
    onCopy: () => void;
    onDownload: () => void;
    t: (k: string) => string;
}> = ({ codes, copied, onCopy, onDownload, t }) => (
    <div className={`py-4 ${divider}`}>
        <p className={`text-xs font-semibold ${muted} mb-3`}>{t('account.backup_codes_warning')}</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
            {codes.map((c, i) => (
                <code key={i} className={`text-center text-xs font-mono tabular-nums py-1.5 px-2 rounded-md bg-[var(--color-m3-surface-container)] dark:bg-[var(--color-m3-dark-surface-container)] ${on}`}>{c}</code>
            ))}
        </div>
        <div className="flex gap-3">
            <button onClick={onCopy} className={`flex items-center gap-1.5 text-xs font-medium ${on} hover:opacity-70 transition-opacity`}>
                {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
                {copied ? t('account.backup_codes_copied') : t('account.backup_codes_copy_all')}
            </button>
            <button onClick={onDownload} className={`flex items-center gap-1.5 text-xs font-medium ${on} hover:opacity-70 transition-opacity`}>
                <Download size={12} strokeWidth={1.5} />{t('account.backup_codes_download')}
            </button>
        </div>
    </div>
);

const TwoFactorPage: React.FC<TwoFactorPageProps> = ({ token, enabled, onStatusChange, onBack, setupRequired = false }) => {
    const { t } = useTranslation();
    const { showDialog } = useDialog();

    const [activeTab, setActiveTab] = useState<ActiveTab>('totp');

    // Whether an *authenticator app* is enrolled. Deliberately not the `enabled`
    // prop: that one is the combined status and is true for someone who only
    // registered a passkey, which used to hand them the "2FA is active" panel
    // and demand a TOTP code from an authenticator they never set up — with no
    // way left to enrol one.
    const [totpEnabled, setTotpEnabled] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);

    // TOTP
    const [step, setStep] = useState<SetupStep>('scan');
    const [secret, setSecret] = useState('');
    const [uri, setUri] = useState('');
    const [code, setCode] = useState('');
    const [secretVisible, setSecretVisible] = useState(false);
    const [secretCopied, setSecretCopied] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [loading, setLoading] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [disablePassword, setDisablePassword] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [disableUseBackup, setDisableUseBackup] = useState(false);
    const [disableBackupCode, setDisableBackupCode] = useState('');
    const [disableLoading, setDisableLoading] = useState(false);
    const [disableError, setDisableError] = useState<string | null>(null);

    // Passkey
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
    const [passkeySuccess, setPasskeySuccess] = useState(false);
    const webauthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

    // Backup codes
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [backupRemaining, setBackupRemaining] = useState<number | null>(null);
    const [backupError, setBackupError] = useState<string | null>(null);
    const [backupCopied, setBackupCopied] = useState(false);
    const backupCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Password confirmation for the two destructive actions
    const [pwPrompt, setPwPrompt] = useState<PasswordPrompt | null>(null);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        loadStatus();
        fetchPasskeys();
        return () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            if (backupCopyTimerRef.current) clearTimeout(backupCopyTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Ask the server which factors are actually on, rather than inferring. */
    const loadStatus = async () => {
        setStatusLoading(true);
        try {
            const status = await authService.get2FAStatus(token);
            setTotpEnabled(!!status.totp);
            onStatusChange(!!status.enabled);
            if (!status.totp) initSetup();
            if (status.totp || status.passkey) fetchBackupRemaining();
        } catch {
            // Offline or a hiccup: assume no authenticator so the enrolment path
            // stays reachable. handleEnable maps the server's "already enabled"
            // rejection back to a clear message if that guess was wrong.
            setTotpEnabled(false);
            initSetup();
            if (enabled) fetchBackupRemaining();
        } finally {
            setStatusLoading(false);
        }
    };

    /** The parent tracks 2FA as one flag, so report either factor being on. */
    const reportStatus = (totp: boolean, passkeyCount: number) => onStatusChange(totp || passkeyCount > 0);

    const passwordErrorMessage = (e: any): string => {
        const msg = e?.message || '';
        if (msg.includes('Incorrect password') || msg.includes('password is required')) return t('account.wrong_password');
        return msg || t('account.2fa_setup_failed');
    };

    const handleCopySecret = () => {
        navigator.clipboard.writeText(secret).then(() => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            setSecretCopied(true);
            copyTimerRef.current = setTimeout(() => setSecretCopied(false), 2000);
        });
    };

    const initSetup = async () => {
        setSetupLoading(true);
        setError(null);
        try {
            const data = await authService.setup2FA(token);
            setSecret(data.secret);
            setUri(data.uri);
        } catch (e: any) {
            setError(e.message || t('account.2fa_setup_failed'));
        } finally {
            setSetupLoading(false);
        }
    };

    const handleEnable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.length !== 6) return;
        setLoading(true);
        setError(null);
        try {
            const result = await authService.enable2FA(token, secret, code);
            setBackupCodes(result.backupCodes ?? []);
            setBackupRemaining(result.backupCodes?.length ?? 0);
            // `totpEnabled` deliberately stays false until the user dismisses the
            // success screen: flipping it here would swap that screen — and the
            // backup codes shown on it exactly once — for the disable form.
            setSuccess(true);
        } catch (e: any) {
            const msg = e.message || '';
            if (msg.includes('already enabled')) {
                // The status probe was wrong (or another device enrolled first):
                // re-read it so the page stops offering enrolment.
                setError(t('account.2fa_already_enabled'));
                loadStatus();
            } else {
                setError(msg.includes('Invalid') ? t('account.2fa_verify_failed') : t('account.2fa_setup_failed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchBackupRemaining = async () => {
        setBackupError(null);
        try {
            const data = await authService.getBackupCodesStatus(token);
            setBackupRemaining(data.remaining);
        } catch (e: any) {
            setBackupError(e?.message || null);
        }
    };

    const handleGenerateBackupCodes = async (password: string) => {
        setPwLoading(true);
        setPwError(null);
        setBackupError(null);
        try {
            const codes = await authService.generateBackupCodes(token, password);
            setBackupCodes(codes);
            setBackupRemaining(codes.length);
            setPwPrompt(null);
        } catch (e: any) {
            setPwError(passwordErrorMessage(e));
        } finally {
            setPwLoading(false);
        }
    };

    const handleCopyBackupCodes = () => {
        navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
            if (backupCopyTimerRef.current) clearTimeout(backupCopyTimerRef.current);
            setBackupCopied(true);
            backupCopyTimerRef.current = setTimeout(() => setBackupCopied(false), 2000);
        });
    };

    const handleDownloadBackupCodes = () => {
        const text = `HRT Tracker - Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nEach code can only be used once. Store these securely.`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hrt-tracker-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const disableReady = disableUseBackup ? !!disableBackupCode.trim() : disableCode.length === 6;

    const handleDisable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!disablePassword || !disableReady) return;
        setDisableLoading(true);
        setDisableError(null);
        try {
            await authService.disable2FA(
                token,
                disablePassword,
                disableUseBackup ? undefined : disableCode,
                disableUseBackup ? disableBackupCode.trim() : undefined,
            );
            setTotpEnabled(false);
            setDisablePassword('');
            setDisableCode('');
            setDisableBackupCode('');
            setDisableUseBackup(false);
            // Turning TOTP off does not turn 2FA off while passkeys remain —
            // reporting a flat `false` here had the account page claiming 2FA
            // was disabled on an account that still demands a passkey.
            reportStatus(false, passkeys.length);
            showDialog('alert', t('account.2fa_disabled_success'));
            onBack();
        } catch (e: any) {
            const msg = e.message || '';
            if (msg.includes('Incorrect password')) {
                setDisableError(t('account.wrong_password'));
            } else if (msg.includes('Invalid 2FA') || msg.includes('backup code')) {
                setDisableError(disableUseBackup ? t('auth.backup_code_invalid') : t('account.2fa_verify_failed'));
            } else {
                setDisableError(t('account.2fa_disable_failed'));
            }
        } finally {
            setDisableLoading(false);
        }
    };

    const fetchPasskeys = async (): Promise<Passkey[]> => {
        setPasskeyLoading(true);
        setPasskeyError(null);
        try {
            const list = await authService.listPasskeys(token);
            setPasskeys(list);
            return list;
        } catch (e: any) {
            setPasskeyError(e.message || t('account.passkey_fetch_failed'));
            return [];
        } finally {
            setPasskeyLoading(false);
        }
    };

    const handleRegisterPasskey = async () => {
        if (!webauthnSupported) return;
        setRegisterLoading(true);
        setPasskeyError(null);
        setPasskeySuccess(false);
        try {
            const opts = await authService.registerPasskeyOptions(token);
            const credential = await navigator.credentials.create({
                publicKey: {
                    // Every field below comes from the server. The old hardcoded
                    // block claimed a fixed 16 zero-byte user handle for
                    // *everyone*, so a second account on the same device
                    // silently overwrote the first account's resident
                    // credential (same rp.id + same user.id = replacement), and
                    // the account picker listed it as "User". It also offered
                    // RS256, which the server cannot verify.
                    rp: { id: opts.rp?.id || window.location.hostname, name: opts.rp?.name || 'HRT Tracker' },
                    user: {
                        id: b64url2ab(opts.user.id),
                        name: opts.user.name,
                        displayName: opts.user.displayName || opts.user.name,
                    },
                    challenge: b64url2ab(opts.challenge),
                    pubKeyCredParams: opts.pubKeyCredParams?.length
                        ? opts.pubKeyCredParams
                        : [{ type: 'public-key' as const, alg: -7 }],
                    authenticatorSelection: opts.authenticatorSelection ?? { userVerification: 'preferred', residentKey: 'preferred' },
                    timeout: opts.timeout ?? 60000,
                    excludeCredentials: opts.excludeCredentialIds?.map(id => ({
                        type: 'public-key' as const,
                        id: b64url2ab(id),
                    })) ?? [],
                },
            }) as PublicKeyCredential | null;
            if (!credential) return;
            const deviceName = detectDeviceName();
            const result = await authService.registerPasskey(token, opts.challengeToken, serializeAttestationCredential(credential), deviceName);
            setPasskeySuccess(true);
            // The first passkey on an account without TOTP gets backup codes
            // minted server-side. They are shown exactly once, and this response
            // was being thrown away — leaving passkey-only users with no
            // recovery path at all and no idea codes had been issued.
            if (result.backupCodes?.length) {
                setBackupCodes(result.backupCodes);
                setBackupRemaining(result.backupCodes.length);
            } else {
                fetchBackupRemaining();
            }
            const list = await fetchPasskeys();
            reportStatus(totpEnabled, list.length);
        } catch (e: any) {
            // The user dismissing the system prompt is not an error worth showing.
            if (e.name === 'NotAllowedError') return;
            const msg = e.message || '';
            if (e.name === 'InvalidStateError' || msg.includes('already registered')) {
                setPasskeyError(t('account.passkey_already_registered'));
            } else {
                setPasskeyError(msg || t('account.passkey_register_failed'));
            }
        } finally {
            setRegisterLoading(false);
        }
    };

    const handleDeletePasskey = async (pk: Passkey, password: string) => {
        setPwLoading(true);
        setPwError(null);
        setDeleteLoadingId(pk.id);
        try {
            await authService.deletePasskey(token, pk.id, password);
            const remaining = passkeys.filter(p => p.id !== pk.id);
            setPasskeys(remaining);
            reportStatus(totpEnabled, remaining.length);
            // Removing the last factor clears the backup codes with it, server
            // side included — so stop showing any that are still on screen.
            if (!totpEnabled && remaining.length === 0) {
                setBackupRemaining(null);
                setBackupCodes([]);
            } else {
                fetchBackupRemaining();
            }
            setPwPrompt(null);
        } catch (e: any) {
            setPwError(passwordErrorMessage(e));
        } finally {
            setPwLoading(false);
            setDeleteLoadingId(null);
        }
    };

    const handlePasswordConfirm = (password: string) => {
        if (!pwPrompt) return;
        if (pwPrompt.kind === 'delete-passkey') handleDeletePasskey(pwPrompt.passkey, password);
        else handleGenerateBackupCodes(password);
    };

    const relativeTime = (ts: number) => {
        const diff = Math.floor(Date.now() / 1000) - ts;
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(ts * 1000).toLocaleDateString();
    };

    return (
        <div className="relative pb-32">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[var(--color-m3-surface-dim)] dark:bg-[var(--color-m3-dark-surface)] px-6 md:px-10 pt-8 pb-3">
                <button
                    onClick={setupRequired ? undefined : onBack}
                    disabled={setupRequired}
                    className={`flex items-center gap-2 -ml-2 px-2 py-1.5 rounded-md transition-colors ${setupRequired ? 'opacity-30 cursor-default' : 'hover:bg-[var(--color-m3-surface-container-low)] dark:hover:bg-[var(--color-m3-dark-surface-container-low)]'}`}
                >
                    <ArrowLeft size={18} strokeWidth={1.5} className={`${muted} shrink-0`} />
                    <span className={`text-xl font-semibold ${on}`}>{t('account.2fa')}</span>
                </button>
            </div>

            {/* Mandatory setup notice */}
            {setupRequired && (
                <div className={`px-6 md:px-10 mb-4 flex items-start gap-2 text-sm ${muted}`}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{t('auth.setup_2fa_required')}</span>
                </div>
            )}

            <div className="px-6 md:px-10 max-w-2xl">
                {/* Tab switcher — underline style */}
                <div className="flex gap-6 mb-6 border-b border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)]">
                    {(['totp', 'passkey'] as ActiveTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === tab
                                    ? `${on} border-[var(--color-m3-on-surface)] dark:border-[var(--color-m3-dark-on-surface)]`
                                    : `${muted} border-transparent hover:text-[var(--color-m3-on-surface)] dark:hover:text-[var(--color-m3-dark-on-surface)]`
                            }`}
                        >
                            {tab === 'totp' ? <KeyRound size={14} strokeWidth={1.5} /> : <Fingerprint size={14} strokeWidth={1.5} />}
                            {tab === 'totp' ? 'TOTP' : 'Passkey'}
                        </button>
                    ))}
                </div>

                {/* ===== TOTP TAB ===== */}
                {activeTab === 'totp' && (
                    <div className="space-y-5">
                        {statusLoading && (
                            <div className="flex justify-center py-10"><Loader2 className={`animate-spin ${muted}`} size={24} /></div>
                        )}

                        {!statusLoading && totpEnabled && (
                            <>
                                <div className="flex items-start gap-3 pb-4">
                                    <SettingsIconBox icon={ShieldIcon} />
                                    <div>
                                        <p className={`text-sm font-medium ${on}`}>{t('account.2fa_is_active')}</p>
                                        <p className={`text-xs ${muted} mt-1 leading-relaxed`}>{t('account.2fa_disable_hint')}</p>
                                    </div>
                                </div>
                                <form onSubmit={handleDisable} className="space-y-4">
                                    <ErrLine msg={disableError} />
                                    <div>
                                        <label className={labelCls}>{t('account.current_password')}</label>
                                        <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
                                            className={inputCls} required autoComplete="current-password"
                                            style={{ fontSize: '16px' }} />
                                    </div>
                                    {disableUseBackup ? (
                                        <div>
                                            <label className={labelCls}>{t('auth.backup_code_label')}</label>
                                            <input type="text" value={disableBackupCode}
                                                onChange={e => setDisableBackupCode(e.target.value.toUpperCase())}
                                                className={`${inputCls} tracking-[0.2em] font-mono text-center`}
                                                placeholder={t('auth.backup_code_placeholder')} required autoComplete="off"
                                                style={{ fontSize: '16px' }} />
                                            <button type="button" onClick={() => { setDisableUseBackup(false); setDisableBackupCode(''); setDisableError(null); }}
                                                className={`mt-2 text-xs font-medium ${muted} hover:text-[var(--color-m3-on-surface)] dark:hover:text-[var(--color-m3-dark-on-surface)] transition-colors`}>
                                                ← {t('account.2fa_code')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className={labelCls}>{t('account.2fa_code')}</label>
                                            <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                                                value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className={`${inputCls} tracking-[0.4em] font-mono text-center`}
                                                placeholder="000000" required autoComplete="one-time-code"
                                                style={{ fontSize: '16px' }} />
                                            {/* Losing the authenticator used to mean losing every way to
                                                turn TOTP off, even while holding valid backup codes. */}
                                            <button type="button" onClick={() => { setDisableUseBackup(true); setDisableCode(''); setDisableError(null); }}
                                                className={`mt-2 text-xs font-medium ${muted} hover:text-[var(--color-m3-on-surface)] dark:hover:text-[var(--color-m3-dark-on-surface)] transition-colors`}>
                                                {t('auth.use_backup_code')}
                                            </button>
                                        </div>
                                    )}
                                    <button type="submit" disabled={disableLoading || !disablePassword || !disableReady}
                                        className={`text-sm font-medium ${muted} hover:text-[var(--color-m3-on-surface)] dark:hover:text-[var(--color-m3-dark-on-surface)] flex items-center gap-1.5 disabled:opacity-40 transition-colors`}>
                                        {disableLoading && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
                                        {t('account.2fa_disable')}
                                    </button>
                                </form>
                            </>
                        )}

                        {!statusLoading && !totpEnabled && (
                            <>
                                {/* An account can hold a passkey and still have no
                                    authenticator app — say so rather than leaving the
                                    setup wizard looking like 2FA is off entirely. */}
                                {passkeys.length > 0 && !success && (
                                    <p className={`flex items-start gap-1.5 text-xs ${muted} leading-relaxed`}>
                                        <Fingerprint size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                                        {t('account.2fa_totp_optional_hint')}
                                    </p>
                                )}

                                {/* Step indicator */}
                                <div className="flex items-center gap-3 mb-2">
                                    {(['scan', 'verify'] as SetupStep[]).map((s, i) => (
                                        <React.Fragment key={s}>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6875rem] font-medium shrink-0 border ${step === s || (success && s === 'verify') ? `${on} border-[var(--color-m3-on-surface)] dark:border-[var(--color-m3-dark-on-surface)] bg-[var(--color-m3-surface-container)] dark:bg-[var(--color-m3-dark-surface-container)]` : `border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)] ${muted}`}`}>
                                                    {success && s === 'verify' ? <Check size={10} strokeWidth={2} /> : i + 1}
                                                </div>
                                                <span className={`text-xs font-medium ${step === s ? on : muted}`}>
                                                    {s === 'scan' ? t('account.2fa_step_scan') : t('account.2fa_step_verify')}
                                                </span>
                                            </div>
                                            {i < 1 && <div className={`flex-1 h-px bg-[var(--color-m3-outline-variant)] dark:bg-[var(--color-m3-dark-outline-variant)]`} />}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {step === 'scan' && (
                                    <div className="space-y-4">
                                        <ErrLine msg={error} />
                                        <p className={`text-sm ${muted}`}>{t('account.2fa_scan_qr')}</p>
                                        <p className={`text-xs ${muted} opacity-70`}>{t('account.2fa_recommended_apps')}</p>
                                        {setupLoading ? (
                                            <div className="flex justify-center py-8"><Loader2 className={`animate-spin ${muted}`} size={24} /></div>
                                        ) : uri ? (
                                            <div className="flex justify-center py-2">
                                                <div className="p-3 bg-white rounded-lg inline-block">
                                                    <QRCodeSVG value={uri} size={160} />
                                                </div>
                                            </div>
                                        ) : null}
                                        {secret && (
                                            <div>
                                                <p className={`text-xs ${muted} mb-1.5`}>{t('account.2fa_secret')}</p>
                                                <div className={`flex items-center gap-2 bg-[var(--color-m3-surface-container)] dark:bg-[var(--color-m3-dark-surface-container)] rounded-md px-3 py-2`}>
                                                    <code className={`flex-1 text-xs font-mono ${on} tracking-widest break-all ${!secretVisible ? 'blur-sm select-none' : ''}`}>{secret}</code>
                                                    <button onClick={() => setSecretVisible(v => !v)} className={muted}>{secretVisible ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}</button>
                                                    <button onClick={handleCopySecret} className={secretCopied ? on : muted}>{secretCopied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}</button>
                                                </div>
                                            </div>
                                        )}
                                        <button onClick={() => setStep('verify')} disabled={!secret || setupLoading} className={primaryBtn}>
                                            {t('account.2fa_next')}
                                        </button>
                                    </div>
                                )}

                                {step === 'verify' && !success && (
                                    <form onSubmit={handleEnable} className="space-y-4">
                                        <p className={`text-sm ${muted}`}>{t('account.2fa_verify')}</p>
                                        <ErrLine msg={error} />
                                        <div>
                                            <label className={labelCls}>{t('account.2fa_code')}</label>
                                            <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                                                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className={`${inputCls} text-center tracking-[0.6em] font-mono text-xl py-3`}
                                                placeholder="000000" autoComplete="one-time-code" autoFocus
                                                style={{ fontSize: '16px' }} />
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setStep('scan')}
                                                className={`flex-1 py-2.5 text-sm font-medium ${muted} border border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)] rounded-md`}>
                                                ← {t('account.2fa_step_scan')}
                                            </button>
                                            <button type="submit" disabled={loading || code.length !== 6} className={`flex-1 py-2.5 ${primaryBtn}`}>
                                                {loading && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                                                {t('account.2fa_enable_btn')}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {success && (
                                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-m3-outline-variant)] dark:border-[var(--color-m3-dark-outline-variant)] bg-[var(--color-m3-surface-container)] dark:bg-[var(--color-m3-dark-surface-container)]">
                                            <Check size={18} strokeWidth={1.5} className={on} />
                                        </div>
                                        <p className={`font-medium ${on}`}>{t('account.2fa_enabled_success')}</p>
                                        <p className={`text-xs ${muted} max-w-xs leading-relaxed`}>{t('account.2fa_success_hint')}</p>
                                        {backupCodes.length > 0 && (
                                            <div className="w-full text-left">
                                                <BackupCodesBlock codes={backupCodes} copied={backupCopied} onCopy={handleCopyBackupCodes} onDownload={handleDownloadBackupCodes} t={t} />
                                            </div>
                                        )}
                                        <button onClick={() => { onStatusChange(true); onBack(); }}
                                            className={`mt-2 px-6 py-2.5 ${primaryBtn} w-auto`}>
                                            {t('btn.ok')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ===== PASSKEY TAB ===== */}
                {activeTab === 'passkey' && (
                    <div className="space-y-5">
                        <p className={`text-xs ${muted}`}>{t('account.passkey_desc')}</p>

                        <ErrLine msg={passkeyError} />
                        {passkeySuccess && (
                            <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
                                <Check size={12} strokeWidth={1.5} className="shrink-0" />{t('account.passkey_registered')}
                            </p>
                        )}

                        {/* Codes minted by registering a passkey are listed by the
                            backup-codes section below — rendering them here too
                            just printed the same eight codes twice. */}

                        {passkeyLoading ? (
                            <div className="flex justify-center py-6"><Loader2 className={`animate-spin ${muted}`} size={20} /></div>
                        ) : passkeys.length === 0 ? (
                            <div className={`flex flex-col items-center gap-2 py-10 text-center ${muted}`}>
                                <SettingsIconBox icon={Fingerprint} />
                                <p className={`text-sm font-medium mt-2 ${on}`}>{t('account.passkey_empty')}</p>
                                <p className="text-xs max-w-xs leading-relaxed">{t('account.passkey_empty_hint')}</p>
                            </div>
                        ) : (
                            <div>
                                {passkeys.map(pk => (
                                    <div key={pk.id} className={`flex items-center gap-3 py-3.5 ${divider}`}>
                                        <SettingsIconBox icon={Fingerprint} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${on} truncate`}>{pk.device_name || 'Unknown device'}</p>
                                            <p className={`text-xs ${muted}`}>{relativeTime(pk.created_at)}</p>
                                        </div>
                                        <button
                                            onClick={() => { setPwError(null); setPwPrompt({ kind: 'delete-passkey', passkey: pk }); }}
                                            disabled={deleteLoadingId === pk.id}
                                            className={`shrink-0 p-1.5 rounded-md ${muted} hover:text-[var(--color-m3-on-surface)] dark:hover:text-[var(--color-m3-dark-on-surface)] hover:bg-[var(--color-m3-surface-container)] dark:hover:bg-[var(--color-m3-dark-surface-container)] disabled:opacity-40 transition-colors`}
                                        >
                                            {deleteLoadingId === pk.id ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : <X size={14} strokeWidth={1.5} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!webauthnSupported ? (
                            <p className={`text-xs text-center ${muted}`}>{t('auth.passkey_unsupported')}</p>
                        ) : (
                            <button onClick={handleRegisterPasskey} disabled={registerLoading} className={primaryBtn}>
                                {registerLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {passkeys.length === 0 ? t('account.passkey_add') : t('account.passkey_add_another')}
                            </button>
                        )}
                    </div>
                )}

                {/* ===== BACKUP CODES SECTION (any factor active) =====
                    Suppressed during the TOTP success screen, which is already
                    showing the same freshly minted codes. */}
                {(totpEnabled || passkeys.length > 0) && !success && (
                    <div className={`mt-8 pt-6 ${divider}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <KeyRound size={15} strokeWidth={1.5} className={muted} />
                            <h3 className={`text-sm font-medium ${on}`}>{t('account.backup_codes')}</h3>
                        </div>
                        <p className={`text-xs ${muted} mb-4`}>
                            {backupRemaining !== null
                                ? t('account.backup_codes_remaining').replace('{n}', String(backupRemaining))
                                : t('account.backup_codes_none')}
                        </p>
                        <p className={`text-xs ${muted} mb-4`}>{t('account.backup_codes_generate_hint')}</p>

                        <ErrLine msg={backupError} />

                        {backupCodes.length > 0 && (
                            <BackupCodesBlock codes={backupCodes} copied={backupCopied} onCopy={handleCopyBackupCodes} onDownload={handleDownloadBackupCodes} t={t} />
                        )}

                        <button
                            onClick={() => { setPwError(null); setPwPrompt({ kind: 'regenerate-backup-codes' }); }}
                            disabled={pwLoading}
                            className={`flex items-center gap-1.5 text-sm font-medium ${on} hover:opacity-70 disabled:opacity-40 mt-3 transition-opacity`}
                        >
                            {pwLoading && pwPrompt?.kind === 'regenerate-backup-codes'
                                ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                                : <RefreshCw size={13} strokeWidth={1.5} />}
                            {backupRemaining !== null && backupRemaining > 0
                                ? t('account.backup_codes_regenerate')
                                : t('account.backup_codes_generate')}
                        </button>
                    </div>
                )}
            </div>

            {/* Both actions behind this prompt destroy a recovery path, so the
                server requires the account password. */}
            <PasswordInputModal
                isOpen={pwPrompt !== null}
                masked
                title={pwPrompt?.kind === 'delete-passkey' ? t('account.passkey_delete_confirm') : t('account.backup_codes_regenerate')}
                description={pwPrompt?.kind === 'delete-passkey' ? t('account.passkey_delete_password_desc') : t('account.backup_codes_password_desc')}
                error={pwError}
                loading={pwLoading}
                onClose={() => { if (!pwLoading) { setPwPrompt(null); setPwError(null); } }}
                onConfirm={handlePasswordConfirm}
            />
        </div>
    );
};

export default TwoFactorPage;
