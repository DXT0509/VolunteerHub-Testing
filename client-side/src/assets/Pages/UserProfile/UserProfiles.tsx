import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ensureValidTokenOrRedirect } from "../../utils/auth";
import { useTranslation } from "react-i18next";

type User = {
    name: string;
    title: string;
    email: string;
    phone: string;
    username: string;
    bio: string;
    avatarUrl: string;
    joinedAt: string; // ISO-like date string
    status: "Active" | "Inactive" | "Pending";
    stats: {
        projects: number;
        followers: number;
        following: number;
    };
    address: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    };
};

const initialUser: User = {
    name: "Leslie Alexander",
    title: "Product Designer",
    email: "leslie@example.com",
    phone: "+1 (555) 000-0000",
    username: "lesliealex",
    bio:
        "Creative product designer with 8+ years of experience shipping delightful, accessible interfaces.",
    avatarUrl: "https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg",
    joinedAt: "2022-07-10",
    status: "Active",
    stats: {
        projects: 18,
        followers: 1240,
        following: 321,
    },
    address: {
        street: "1234 Market St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        country: "United States",
    },
};

export default function UserProfileStandalone() {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const routeState = (location?.state || null) as
        | {
            username?: string;
            email?: string;
            full_name?: string;
            avatar_url?: string;
            phone?: string;
        }
        | null;

    const defaultUser: User = {
        ...initialUser,
        name: routeState?.full_name ?? initialUser.name,
        email: routeState?.email ?? initialUser.email,
        phone: routeState?.phone ?? initialUser.phone,
        username: routeState?.username ?? initialUser.username,
    };

    const [user, setUser] = useState<User>(defaultUser);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Page meta (no external libraries)
    useEffect(() => {
        const prevTitle = document.title;
        document.title =
            "React Profile Dashboard | Tailwind Admin UI - Standalone";
        const desc = document.querySelector('meta[name="description"]');
        const restoreContent = desc?.getAttribute("content") || "";
        if (desc) {
            desc.setAttribute(
                "content",
                "Standalone user profile page built with React and Tailwind CSS."
            );
        } else {
            const meta = document.createElement("meta");
            meta.name = "description";
            meta.content =
                "Standalone user profile page built with React and Tailwind CSS.";
            document.head.appendChild(meta);
        }
        return () => {
            document.title = prevTitle;
            if (desc) desc.setAttribute("content", restoreContent);
        };
    }, []);

    const onSave = async (nextUser: User, avatarFileParam?: File | null) => {
        setSaving(true);
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const fd = new FormData();
            fd.append("full_name", nextUser.name);
            fd.append("phone", nextUser.phone);
            fd.append("username", nextUser.username);
            // If a local avatar file is selected, include it
            if (avatarFileParam) {
                fd.append("avatar", avatarFileParam);
            }

            const res = await fetch("http://localhost:4000/users/me", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Do NOT set Content-Type for FormData; browser will set boundary
                } as any,
                body: fd,
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.error || t('profile.errors.updateFailed'));
            }
            const saved = await res.json();
            // Update local state with server values, including avatar_url if present (absolute URL)
            const avatarUrl = saved?.avatar_url ? `http://localhost:4000${saved.avatar_url}` : nextUser.avatarUrl;
            setUser({ ...nextUser, avatarUrl });
            setSavedAt(new Date());
            // Persist latest user info into localStorage so Navbar reflects changes after reload
            try {
                const rawStr = localStorage.getItem("user");
                const raw = rawStr ? JSON.parse(rawStr) : {};
                const updatedRaw = {
                    ...raw,
                    full_name: saved?.full_name ?? nextUser.name,
                    username: saved?.username ?? nextUser.username,
                    phone: saved?.phone ?? nextUser.phone,
                    // Store relative path for avatar_url (e.g., /uploads/...), Navbar will convert to absolute
                    avatar_url: saved?.avatar_url ?? (nextUser.avatarUrl?.startsWith("http") ? nextUser.avatarUrl.replace("http://localhost:4000", "") : nextUser.avatarUrl),
                };
                localStorage.setItem("user", JSON.stringify(updatedRaw));
            } catch {}
            // Force a full page refresh so the entire app (including Navbar) updates
            try {
                window.location.reload();
            } catch {}
            // Clear local blob URL if replaced
            if (avatarFileParam && avatarUrl && avatarUrl.startsWith("/uploads/")) {
                try {
                    if (nextUser.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(nextUser.avatarUrl);
                } catch {}
            }
        } catch (e: any) {
            setError(e?.message || t('profile.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    // Fetch real user profile from API
    useEffect(() => {
        if (!ensureValidTokenOrRedirect(navigate)) return;
        const token = localStorage.getItem("token");
        setLoading(true);
        setError(null);
        fetch("http://localhost:4000/users/me", {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j?.error || t('profile.errors.fetchFailed'));
                }
                return res.json();
            })
            .then((u) => {
                const roleName = ((u.roles || []).map((r: any) => r?.role?.name)[0]) || "VOLUNTEER";
                const title = roleName === "EVENT_MANAGER" ? t('profile.roles.manager') : t('profile.roles.volunteer');
                const status: User["status"] = u.is_active ? "Active" : "Inactive";
                const joinedAt = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : initialUser.joinedAt;
                const avatarUrl = u.avatar_url ? `http://localhost:4000${u.avatar_url}` : initialUser.avatarUrl;
                const next: User = {
                    ...initialUser,
                    name: u.full_name || initialUser.name,
                    title,
                    email: u.email || initialUser.email,
                    phone: u.phone || initialUser.phone,
                    username: u.username || initialUser.username,
                    bio: initialUser.bio,
                    avatarUrl,
                    joinedAt,
                    status,
                    stats: initialUser.stats,
                    address: initialUser.address,
                };
                setUser(next);
            })
            .catch((err) => setError(err.message || String(err)))
            .finally(() => setLoading(false));
    }, [navigate]);

    return (
        <div className="min-h-dvh bg-gray-50 p-4 text-gray-900 antialiased dark:bg-gray-950 dark:text-white">
            <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
                <Breadcrumb pageTitle={t('profile.pageTitle')} />

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                    <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
                        {t('profile.sectionTitle')}
                    </h3>

                    <div className="space-y-6">
                        {loading && (
                            <p className="text-sm text-gray-600">{t('profile.loading')}</p>
                        )}
                        {error && (
                            <p className="text-sm text-rose-600">{error}</p>
                        )}
                        <UserMetaCard
                            user={user}
                        />

                        <UserInfoCard
                            user={user}
                            saving={saving}
                            savedAt={savedAt}
                            onSave={onSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------- UI ---------------------------------- */

function Breadcrumb({ pageTitle }: { pageTitle: string }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-between">
            <nav
                aria-label="Breadcrumb"
                className="text-sm text-gray-500 dark:text-gray-400"
            >
                <ol className="flex items-center space-x-2">
                    <li>
                        <span className="hover:text-gray-700 dark:hover:text-gray-200">
                            {t('nav.home')}
                        </span>
                    </li>
                    <li className="select-none">/</li>
                    <li className="font-medium text-gray-800 dark:text-gray-200">
                        {pageTitle}
                    </li>
                </ol>
            </nav>
        </div>
    );
}

function UserMetaCard({ user }: { user: User }) {
    const { t } = useTranslation();
    const joined = useMemo(() => {
        try {
            return new Date(user.joinedAt).toLocaleDateString();
        } catch {
            return user.joinedAt;
        }
    }, [user.joinedAt]);

    return (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                    <img
                        src={user.avatarUrl}
                        alt={`${user.name} avatar`}
                        className="h-20 w-20 rounded-full border border-gray-200 object-cover dark:border-gray-800"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {user.name}
                            </h4>
                            <StatusBadge status={user.status} />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('profile.joined', { date: joined })}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function StatusBadge({ status }: { status: User["status"] }) {
    const { t } = useTranslation();
    const colors =
        status === "Active"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-700/40"
            : status === "Pending"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-700/40"
                : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-700/40";
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${status === "Active"
                    ? "bg-emerald-500"
                    : status === "Pending"
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    }`}
            />
            {status === 'Active' ? t('profile.status.active') : status === 'Pending' ? t('profile.status.pending') : t('profile.status.inactive')}
        </span>
    );
}

// (removed unused Stat helper)


function UserInfoCard({
    user,
    saving,
    savedAt,
    onSave,
}: {
    user: User;
    saving: boolean;
    savedAt: Date | null;
    onSave: (next: User, avatarFileParam?: File | null) => void | Promise<void>;
}) {
    const { t } = useTranslation();
    const [form, setForm] = useState(() => ({
        name: user.name,
        title: user.title,
        phone: user.phone,
        username: user.username,
        avatarUrl: user.avatarUrl,
    }));
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm({
            name: user.name,
            title: user.title,
            phone: user.phone,
            username: user.username,
            avatarUrl: user.avatarUrl,
        });
    }, [user]);

    const handleChange =
        (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm((f) => ({ ...f, [key]: e.target.value }));

    const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setAvatarFile(file);
        if (file) {
            const url = URL.createObjectURL(file);
            setForm((f) => ({ ...f, avatarUrl: url }));
        }
    };

    // Revoke object URL when avatarFile changes or on unmount
    useEffect(() => {
        return () => {
            if (form.avatarUrl && form.avatarUrl.startsWith("blob:")) {
                try {
                    URL.revokeObjectURL(form.avatarUrl);
                } catch { }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avatarFile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Simple validation
        if (!form.name.trim()) return setError(t('profile.fields.fullName') + ' ' + '*');
        // Email is read-only and not editable here
        // No website validation

        await onSave({ ...user, ...form }, avatarFile);
    };

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02] sm:p-5">
            <h4 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
                {t('profile.personalInfo')}
            </h4>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label={t('profile.fields.fullName')}
                        value={form.name}
                        onChange={handleChange("name")}
                        placeholder={t('profile.placeholders.fullName')}
                        layout="horizontal"
                        required
                    />
                    <TextField
                        label={t('profile.fields.role')}
                        value={user.title}
                        onChange={() => {}}
                        placeholder=""
                        layout="horizontal"
                        disabled
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label={t('profile.fields.email')}
                        type="email"
                        value={user.email}
                        onChange={() => {}}
                        placeholder={t('profile.placeholders.email')}
                        layout="horizontal"
                        disabled
                    />
                    <TextField
                        label={t('profile.fields.phone')}
                        value={form.phone}
                        onChange={handleChange("phone")}
                        placeholder={t('profile.placeholders.phone')}
                        layout="horizontal"
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label={t('profile.fields.username')}
                        value={form.username}
                        onChange={handleChange("username")}
                        placeholder={t('profile.placeholders.username')}
                        layout="horizontal"
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">

                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('profile.avatar.label')}
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-transparent dark:text-white dark:focus:border-gray-500 dark:focus:ring-white/10"
                        />
                    </label>
                    <div className="w-30 h-30 flex items-center justify-center rounded-full overflow-hidden ">
                        <PreviewAvatar url={form.avatarUrl} name={form.name} />
                    </div>

                </div>

                {/* Bio removed */}

                {error && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                )}
                {savedAt && !saving && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t('profile.savedAt', { time: savedAt.toLocaleTimeString() })}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-white"
                    >
                        {saving ? t('profile.buttons.saving') : t('profile.buttons.save')}
                    </button>
                    <button
                        type="button"
                        className="text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-300"
                        onClick={() =>
                            setForm({
                                name: user.name,
                                title: user.title,
                                phone: user.phone,
                                username: user.username,
                                avatarUrl: user.avatarUrl,
                            })
                        }
                    >
                        {t('profile.buttons.reset')}
                    </button>
                    {/* Clear selected file on reset */}
                    {avatarFile && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t('profile.localImageCleared')}</span>
                    )}
                </div>
            </form>
        </section>
    );
}


/* -------------------------------- Fields -------------------------------- */

function TextField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    required,
    layout = "vertical",
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
    layout?: "vertical" | "horizontal";
    disabled?: boolean;
}) {
    if (layout === "horizontal") {
        return (
            <div className="flex items-center gap-4">
                <span className="min-w-28 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label} {required && <span className="text-rose-500">*</span>}
                </span>
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-transparent dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-white/10"
                />
            </div>
        );
    }
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label} {required && <span className="text-rose-500">*</span>}
            </span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-transparent dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-white/10"
            />
        </label>
    );
}

function TextArea({
    label,
    value,
    onChange,
    placeholder,
    rows = 3,
}: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </span>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-transparent dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-white/10"
            />
        </label>
    );
}

function PreviewAvatar({ url, name }: { url: string; name: string }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-end gap-3">
            <div>
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('profile.preview')}
                </span>
                <img
                    src={url || "https://via.placeholder.com/80?text=Avatar"}
                    alt={`${name} avatar preview`}
                    className="h-16 w-16 rounded-full border border-gray-200 object-cover dark:border-gray-800"
                />
            </div>
        </div>
    );
}

/* ------------------------------- Utilities ------------------------------ */

// (removed unused utility)