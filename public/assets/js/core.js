// ============================================================
// INTELLIVERIFY — CORE
// ============================================================
// Single shared file for every page:
//   • Supabase client
//   • Backend API wrapper (with auth header)
//   • Auth helpers (getCurrentUser, requireAuth, requireRole)
//   • Design system CSS injection
//   • Sidebar + topbar shell renderer
//   • Toast, modal, confirm
//   • Notification bell + polling
//   • Small utilities (escapeHTML, dates, initials)
// ============================================================

(function () {
    'use strict';

    // =========================================================
    // CONFIG
    // =========================================================

    const SUPABASE_URL = 'https://yxgxzflcgrzfndzxqibg.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MSQ4teFGuhQt0xLWa2pZvA_FEWY7Qml';
    const API_BASE = '';  // same origin — backend serves this frontend

    // =========================================================
    // SUPABASE CLIENT
    // =========================================================

    if (!window.supabase) {
        console.error('[core] Supabase SDK not loaded. Include the CDN script before core.js.');
        return;
    }

    const sb = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    window.sb = sb;
    window.SUPABASE_URL = SUPABASE_URL;

    // =========================================================
    // DESIGN SYSTEM CSS
    // =========================================================

    const DESIGN_SYSTEM = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
        --iv-font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        --iv-font-mono: ui-monospace, 'SF Mono', Menlo, monospace;

        --iv-bg: #ffffff;
        --iv-bg-subtle: #fafafa;
        --iv-bg-muted: #f4f4f5;

        --iv-text: #18181b;
        --iv-text-2: #52525b;
        --iv-text-3: #a1a1aa;
        --iv-text-inverse: #fafafa;

        --iv-border: rgba(0, 0, 0, 0.08);
        --iv-border-strong: rgba(0, 0, 0, 0.14);

        --iv-accent: #18181b;
        --iv-accent-hover: #27272a;
        --iv-focus: #4f46e5;
        --iv-focus-ring: rgba(79, 70, 229, 0.18);

        --iv-success: #16a34a;
        --iv-success-bg: #f0fdf4;
        --iv-success-border: #bbf7d0;

        --iv-warning: #ca8a04;
        --iv-warning-bg: #fefce8;
        --iv-warning-border: #fef08a;

        --iv-danger: #dc2626;
        --iv-danger-bg: #fef2f2;
        --iv-danger-border: #fecaca;

        --iv-info: #2563eb;
        --iv-info-bg: #eff6ff;
        --iv-info-border: #bfdbfe;

        --iv-r-sm: 6px;
        --iv-r-md: 8px;
        --iv-r-lg: 12px;

        --iv-shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
        --iv-shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --iv-shadow-md: 0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
        --iv-shadow-lg: 0 12px 32px rgba(0,0,0,0.10);

        --iv-s-1: 4px;  --iv-s-2: 8px;   --iv-s-3: 12px;
        --iv-s-4: 16px; --iv-s-5: 20px;  --iv-s-6: 24px;
        --iv-s-8: 32px; --iv-s-10: 40px; --iv-s-12: 48px;

        --iv-sidebar-w: 260px;
        --iv-topbar-h: 64px;
        --iv-transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    html, body {
        font-family: var(--iv-font);
        font-size: 15px;
        line-height: 1.5;
        color: var(--iv-text);
        background: var(--iv-bg);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    body { min-height: 100vh; }

    /* ---------- Shell ---------- */

    #iv-shell { display: flex; min-height: 100vh; width: 100%; }

    .iv-sidebar {
        width: var(--iv-sidebar-w);
        background: var(--iv-bg);
        border-right: 1px solid var(--iv-border);
        position: fixed;
        top: 0; left: 0; bottom: 0;
        z-index: 40;
        overflow-y: auto;
    }

    .iv-sidebar-inner {
        display: flex; flex-direction: column;
        height: 100%; padding: var(--iv-s-4);
    }

    .iv-sidebar-brand {
        display: flex; align-items: center; gap: var(--iv-s-3);
        padding: var(--iv-s-2) var(--iv-s-2) var(--iv-s-5);
        border-bottom: 1px solid var(--iv-border);
        margin-bottom: var(--iv-s-5);
    }

    .iv-sidebar-logo {
        width: 36px; height: 36px;
        border-radius: var(--iv-r-md);
        background: var(--iv-accent);
        color: var(--iv-text-inverse);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px;
    }

    .iv-sidebar-brand-name {
        font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    }

    .iv-sidebar-brand-role {
        font-size: 12px; color: var(--iv-text-3); margin-top: 2px;
    }

    .iv-sidebar-nav {
        display: flex; flex-direction: column;
        gap: 2px; flex: 1;
    }

    .iv-nav-item {
        display: flex; align-items: center;
        gap: var(--iv-s-3);
        padding: 9px var(--iv-s-3);
        border-radius: var(--iv-r-sm);
        font-size: 14px;
        font-weight: 500;
        color: var(--iv-text-2);
        text-decoration: none;
        border: none;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        width: 100%;
        transition: var(--iv-transition);
    }

    .iv-nav-item:hover {
        background: var(--iv-bg-muted);
        color: var(--iv-text);
    }

    .iv-nav-item i { width: 16px; text-align: center; font-size: 14px; }

    .iv-nav-item-active,
    .iv-nav-item-active:hover {
        background: var(--iv-accent);
        color: var(--iv-text-inverse);
    }

    .iv-sidebar-footer {
        padding-top: var(--iv-s-4);
        border-top: 1px solid var(--iv-border);
        margin-top: var(--iv-s-4);
    }

    .iv-nav-item-signout { color: var(--iv-danger); }
    .iv-nav-item-signout:hover {
        background: var(--iv-danger-bg);
        color: var(--iv-danger);
    }

    .iv-sidebar-backdrop {
        display: none;
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 39;
    }

    .iv-main {
        flex: 1;
        margin-left: var(--iv-sidebar-w);
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .iv-topbar {
        height: var(--iv-topbar-h);
        background: var(--iv-bg);
        border-bottom: 1px solid var(--iv-border);
        padding: 0 var(--iv-s-6);
        display: flex;
        align-items: center;
        gap: var(--iv-s-4);
        position: sticky;
        top: 0;
        z-index: 30;
    }

    .iv-hamburger {
        display: none;
        width: 40px; height: 40px;
        border-radius: var(--iv-r-sm);
        border: none; background: transparent;
        font-size: 16px; cursor: pointer;
        color: var(--iv-text-2);
        align-items: center; justify-content: center;
    }

    .iv-hamburger:hover { background: var(--iv-bg-muted); }

    .iv-topbar-title { flex: 1; min-width: 0; }

    .iv-topbar-title h1 {
        font-size: 17px; font-weight: 600;
        letter-spacing: -0.015em;
        color: var(--iv-text);
        line-height: 1.2;
    }

    .iv-topbar-title p {
        font-size: 13px; color: var(--iv-text-3);
        margin-top: 2px;
    }

    .iv-topbar-actions {
        display: flex; align-items: center; gap: var(--iv-s-2);
    }

    .iv-icon-btn {
        width: 38px; height: 38px;
        border-radius: var(--iv-r-sm);
        background: transparent; border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--iv-text-2);
        font-size: 15px;
        position: relative;
        transition: var(--iv-transition);
    }

    .iv-icon-btn:hover { background: var(--iv-bg-muted); color: var(--iv-text); }

    .iv-bell-count {
        position: absolute;
        top: 4px; right: 4px;
        background: var(--iv-danger);
        color: #fff;
        font-size: 10px; font-weight: 600;
        padding: 1px 5px;
        border-radius: 10px;
        min-width: 16px; text-align: center;
        line-height: 1.4;
        border: 2px solid var(--iv-bg);
    }

    .iv-user-menu { position: relative; }

    .iv-user-btn {
        display: flex; align-items: center; gap: var(--iv-s-2);
        padding: 4px 10px 4px 4px;
        border-radius: var(--iv-r-md);
        border: 1px solid var(--iv-border);
        background: var(--iv-bg);
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        color: var(--iv-text);
        transition: var(--iv-transition);
    }

    .iv-user-btn:hover { background: var(--iv-bg-muted); }

    .iv-user-avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: var(--iv-accent);
        color: var(--iv-text-inverse);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 600;
    }

    .iv-user-name {
        max-width: 120px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-weight: 500;
    }

    .iv-user-btn .fa-chevron-down { font-size: 10px; color: var(--iv-text-3); }

    .iv-user-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: var(--iv-bg);
        border: 1px solid var(--iv-border);
        border-radius: var(--iv-r-md);
        box-shadow: var(--iv-shadow-lg);
        min-width: 240px;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-4px);
        transition: var(--iv-transition);
        z-index: 50;
    }

    .iv-user-dropdown-open {
        opacity: 1; pointer-events: auto; transform: translateY(0);
    }

    .iv-user-dropdown-header {
        padding: var(--iv-s-4);
        border-bottom: 1px solid var(--iv-border);
    }

    .iv-user-dropdown-name { font-size: 14px; font-weight: 600; }
    .iv-user-dropdown-email {
        font-size: 12px; color: var(--iv-text-3); margin-top: 2px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .iv-user-dropdown-body { padding: var(--iv-s-2); }

    .iv-user-dropdown-item {
        display: flex; align-items: center; gap: var(--iv-s-3);
        width: 100%; padding: 8px 10px;
        border-radius: var(--iv-r-sm);
        border: none; background: transparent;
        text-decoration: none;
        color: var(--iv-text-2);
        font-family: inherit; font-size: 13.5px;
        cursor: pointer; text-align: left;
    }

    .iv-user-dropdown-item:hover { background: var(--iv-bg-muted); color: var(--iv-text); }

    .iv-user-dropdown-item-danger { color: var(--iv-danger); }
    .iv-user-dropdown-item-danger:hover {
        background: var(--iv-danger-bg); color: var(--iv-danger);
    }

    .iv-content {
        padding: var(--iv-s-6);
        max-width: 1400px;
        width: 100%;
        margin: 0 auto;
    }

    /* ---------- Notification panel ---------- */

    .iv-notif-panel {
        position: fixed;
        background: var(--iv-bg);
        border: 1px solid var(--iv-border);
        border-radius: var(--iv-r-md);
        box-shadow: var(--iv-shadow-lg);
        width: 360px;
        max-width: calc(100vw - 32px);
        max-height: 480px;
        display: flex; flex-direction: column;
        z-index: 60;
    }

    .iv-notif-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: var(--iv-s-3) var(--iv-s-4);
        border-bottom: 1px solid var(--iv-border);
        font-size: 13.5px; font-weight: 600;
    }

    .iv-notif-mark-all {
        background: transparent; border: none;
        color: var(--iv-focus);
        font-size: 12px; font-weight: 500;
        cursor: pointer; font-family: inherit;
        padding: 4px 8px; border-radius: var(--iv-r-sm);
    }

    .iv-notif-mark-all:hover { background: var(--iv-bg-muted); }

    .iv-notif-list { overflow-y: auto; flex: 1; }

    .iv-notif-item {
        display: flex; gap: var(--iv-s-3);
        padding: var(--iv-s-3) var(--iv-s-4);
        border-bottom: 1px solid var(--iv-border);
        cursor: pointer;
        transition: var(--iv-transition);
    }

    .iv-notif-item:last-child { border-bottom: none; }
    .iv-notif-item:hover { background: var(--iv-bg-subtle); }

    .iv-notif-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: transparent;
        flex-shrink: 0; margin-top: 7px;
    }

    .iv-notif-item-unread .iv-notif-dot { background: var(--iv-focus); }

    .iv-notif-body { flex: 1; min-width: 0; }

    .iv-notif-title { font-size: 13.5px; font-weight: 600; color: var(--iv-text); }

    .iv-notif-text {
        font-size: 12.5px; color: var(--iv-text-2);
        margin-top: 2px; line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .iv-notif-time { font-size: 11.5px; color: var(--iv-text-3); margin-top: 4px; }

    .iv-notif-empty {
        padding: var(--iv-s-8) var(--iv-s-4);
        text-align: center;
        color: var(--iv-text-3);
        font-size: 13px;
    }

    /* ---------- Buttons ---------- */

    .iv-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--iv-s-2);
        height: 38px;
        padding: 0 var(--iv-s-4);
        border-radius: var(--iv-r-sm);
        font-family: inherit;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        text-decoration: none;
        transition: var(--iv-transition);
        white-space: nowrap;
    }

    .iv-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .iv-btn-primary { background: var(--iv-accent); color: var(--iv-text-inverse); }
    .iv-btn-primary:hover:not(:disabled) { background: var(--iv-accent-hover); }

    .iv-btn-secondary {
        background: var(--iv-bg); color: var(--iv-text);
        border-color: var(--iv-border-strong);
    }
    .iv-btn-secondary:hover:not(:disabled) { background: var(--iv-bg-muted); }

    .iv-btn-danger { background: var(--iv-danger); color: #fff; }
    .iv-btn-danger:hover:not(:disabled) { background: #b91c1c; }

    .iv-btn-ghost {
        background: transparent; color: var(--iv-text-2); border: none;
    }
    .iv-btn-ghost:hover:not(:disabled) { background: var(--iv-bg-muted); color: var(--iv-text); }

    .iv-btn-sm { height: 32px; padding: 0 12px; font-size: 12.5px; }
    .iv-btn-lg { height: 44px; padding: 0 20px; font-size: 15px; }

    /* ---------- Cards ---------- */

    .iv-card {
        background: var(--iv-bg);
        border: 1px solid var(--iv-border);
        border-radius: var(--iv-r-lg);
        padding: var(--iv-s-5);
    }

    .iv-card-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: var(--iv-s-4);
        margin-bottom: var(--iv-s-4);
    }

    .iv-card-title {
        font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    }

    .iv-card-subtitle {
        font-size: 13px; color: var(--iv-text-3); margin-top: 2px;
    }

    /* ---------- Forms ---------- */

    .iv-form-group { margin-bottom: var(--iv-s-4); }

    .iv-label {
        display: block;
        font-size: 13px; font-weight: 500;
        color: var(--iv-text-2);
        margin-bottom: var(--iv-s-2);
    }

    .iv-input, .iv-select, .iv-textarea {
        width: 100%; height: 38px;
        padding: 0 var(--iv-s-3);
        border-radius: var(--iv-r-sm);
        border: 1px solid var(--iv-border-strong);
        background: var(--iv-bg);
        font-family: inherit; font-size: 14px;
        color: var(--iv-text);
        transition: var(--iv-transition);
    }

    .iv-textarea {
        height: auto;
        padding: var(--iv-s-3);
        min-height: 110px;
        resize: vertical; line-height: 1.5;
    }

    .iv-input:focus, .iv-select:focus, .iv-textarea:focus {
        outline: none;
        border-color: var(--iv-focus);
        box-shadow: 0 0 0 3px var(--iv-focus-ring);
    }

    .iv-input::placeholder, .iv-textarea::placeholder { color: var(--iv-text-3); }

    .iv-help { font-size: 12.5px; color: var(--iv-text-3); margin-top: var(--iv-s-2); }
    .iv-error { font-size: 12.5px; color: var(--iv-danger); margin-top: var(--iv-s-2); }

    /* ---------- Badges ---------- */

    .iv-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 11.5px; font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        border: 1px solid transparent;
    }

    .iv-badge-low      { background: var(--iv-success-bg); color: var(--iv-success); border-color: var(--iv-success-border); }
    .iv-badge-medium   { background: var(--iv-warning-bg); color: var(--iv-warning); border-color: var(--iv-warning-border); }
    .iv-badge-high     { background: var(--iv-danger-bg);  color: var(--iv-danger);  border-color: var(--iv-danger-border); }
    .iv-badge-pending  { background: var(--iv-warning-bg); color: var(--iv-warning); border-color: var(--iv-warning-border); }
    .iv-badge-approved { background: var(--iv-success-bg); color: var(--iv-success); border-color: var(--iv-success-border); }
    .iv-badge-revision { background: var(--iv-info-bg);    color: var(--iv-info);    border-color: var(--iv-info-border); }
    .iv-badge-rejected { background: var(--iv-danger-bg);  color: var(--iv-danger);  border-color: var(--iv-danger-border); }
    .iv-badge-neutral  { background: var(--iv-bg-muted);   color: var(--iv-text-2);  border-color: var(--iv-border); }

    /* ---------- Grid ---------- */

    .iv-grid { display: grid; gap: var(--iv-s-4); }
    .iv-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .iv-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .iv-grid-4 { grid-template-columns: repeat(4, 1fr); }

    /* ---------- Table ---------- */

    .iv-table-wrap {
        background: var(--iv-bg);
        border: 1px solid var(--iv-border);
        border-radius: var(--iv-r-lg);
        overflow: hidden;
    }

    .iv-table {
        width: 100%; border-collapse: collapse; font-size: 13.5px;
    }

    .iv-table th {
        text-align: left;
        padding: 12px var(--iv-s-5);
        background: var(--iv-bg-subtle);
        font-size: 12px; font-weight: 600;
        color: var(--iv-text-3);
        text-transform: uppercase; letter-spacing: 0.04em;
        border-bottom: 1px solid var(--iv-border);
    }

    .iv-table td {
        padding: 14px var(--iv-s-5);
        border-bottom: 1px solid var(--iv-border);
        color: var(--iv-text-2);
    }

    .iv-table tbody tr:last-child td { border-bottom: none; }
    .iv-table tbody tr:hover td { background: var(--iv-bg-subtle); }

    /* ---------- Toast ---------- */

    #iv-toast-container {
        position: fixed;
        top: 20px; right: 20px;
        z-index: 100;
        display: flex; flex-direction: column; gap: 10px;
        pointer-events: none;
        max-width: calc(100vw - 40px);
    }

    .iv-toast {
        display: flex; align-items: center; gap: var(--iv-s-3);
        padding: 12px 16px;
        border-radius: var(--iv-r-md);
        background: var(--iv-bg);
        border: 1px solid var(--iv-border);
        box-shadow: var(--iv-shadow-lg);
        font-size: 13.5px;
        color: var(--iv-text);
        opacity: 0;
        transform: translateY(-8px);
        transition: var(--iv-transition);
        pointer-events: auto;
        max-width: 380px;
    }

    .iv-toast-show { opacity: 1; transform: translateY(0); }
    .iv-toast i { font-size: 15px; flex-shrink: 0; }
    .iv-toast-success i { color: var(--iv-success); }
    .iv-toast-error i { color: var(--iv-danger); }
    .iv-toast-warning i { color: var(--iv-warning); }
    .iv-toast-info i { color: var(--iv-info); }

    /* ---------- Modal ---------- */

    .iv-modal-root {
        position: fixed; inset: 0;
        z-index: 200;
        display: flex; align-items: center; justify-content: center;
        padding: var(--iv-s-4);
        opacity: 0; pointer-events: none;
        transition: var(--iv-transition);
    }

    .iv-modal-open { opacity: 1; pointer-events: auto; }

    .iv-modal-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(2px);
    }

    .iv-modal {
        position: relative;
        background: var(--iv-bg);
        border-radius: var(--iv-r-lg);
        box-shadow: var(--iv-shadow-lg);
        width: 100%; max-width: 480px;
        max-height: calc(100vh - 40px);
        display: flex; flex-direction: column;
        transform: scale(0.96);
        transition: var(--iv-transition);
    }

    .iv-modal-open .iv-modal { transform: scale(1); }
    .iv-modal-wide { max-width: 720px; }

    .iv-modal-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: var(--iv-s-4) var(--iv-s-5);
        border-bottom: 1px solid var(--iv-border);
    }

    .iv-modal-header h3 { font-size: 15px; font-weight: 600; }

    .iv-modal-close {
        width: 32px; height: 32px;
        border: none; background: transparent;
        border-radius: var(--iv-r-sm);
        cursor: pointer;
        color: var(--iv-text-3);
        font-size: 14px;
    }

    .iv-modal-close:hover { background: var(--iv-bg-muted); color: var(--iv-text); }

    .iv-modal-body { padding: var(--iv-s-5); overflow-y: auto; flex: 1; }
    .iv-modal-text { font-size: 14px; color: var(--iv-text-2); line-height: 1.55; }

    .iv-modal-footer {
        display: flex; justify-content: flex-end; gap: var(--iv-s-2);
        padding: var(--iv-s-4) var(--iv-s-5);
        border-top: 1px solid var(--iv-border);
    }

    /* ---------- Empty / Loading ---------- */

    .iv-empty {
        text-align: center;
        padding: var(--iv-s-10) var(--iv-s-4);
        color: var(--iv-text-3);
    }

    .iv-empty i { font-size: 32px; margin-bottom: var(--iv-s-3); opacity: 0.4; }
    .iv-empty-title { font-size: 14px; font-weight: 500; color: var(--iv-text-2); }
    .iv-empty-text { font-size: 13px; margin-top: 4px; }

    .iv-loading { padding: var(--iv-s-10); text-align: center; color: var(--iv-text-3); }
    .iv-loading i { font-size: 18px; }

    /* ---------- Utility ---------- */

    .iv-row { display: flex; align-items: center; gap: var(--iv-s-3); }
    .iv-row-between { display: flex; align-items: center; justify-content: space-between; gap: var(--iv-s-3); }
    .iv-col { display: flex; flex-direction: column; gap: var(--iv-s-3); }
    .iv-muted { color: var(--iv-text-3); }
    .iv-text-sm { font-size: 13px; }
    .iv-text-xs { font-size: 12px; }
    .iv-mb-2 { margin-bottom: var(--iv-s-2); }
    .iv-mb-4 { margin-bottom: var(--iv-s-4); }
    .iv-mb-6 { margin-bottom: var(--iv-s-6); }
    .iv-mt-4 { margin-top: var(--iv-s-4); }
    .iv-hidden { display: none !important; }
    .iv-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .iv-mono { font-family: var(--iv-font-mono); }

    /* ---------- Mobile ---------- */

    @media (max-width: 900px) {
        .iv-sidebar {
            transform: translateX(-100%);
            transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: var(--iv-shadow-lg);
        }
        .iv-sidebar-open { transform: translateX(0); }
        .iv-sidebar-backdrop-open { display: block; }
        .iv-main { margin-left: 0; }
        .iv-hamburger { display: flex; }
        .iv-content { padding: var(--iv-s-4); }
        .iv-user-name { display: none; }
        .iv-user-btn { padding: 4px; }
        .iv-grid-2, .iv-grid-3, .iv-grid-4 { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
        .iv-topbar { padding: 0 var(--iv-s-4); gap: var(--iv-s-2); }
        .iv-topbar-title h1 { font-size: 15px; }
        .iv-topbar-title p { display: none; }
        .iv-notif-panel { right: 8px !important; left: 8px; width: auto !important; }
        .iv-modal-footer { flex-direction: column-reverse; }
        .iv-modal-footer .iv-btn { width: 100%; }
    }
    `;

    (function injectStyles() {
        const s = document.createElement('style');
        s.id = 'iv-design-system';
        s.textContent = DESIGN_SYSTEM;
        document.head.appendChild(s);
    })();

    // =========================================================
    // API WRAPPER
    // =========================================================

    async function getToken() {
        const { data } = await sb.auth.getSession();
        return data?.session?.access_token || null;
    }

    async function api(path, options = {}) {
        const token = await getToken();
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch(API_BASE + path, {
            ...options,
            headers,
            body: options.body && typeof options.body !== 'string'
                ? JSON.stringify(options.body)
                : options.body
        });

        let data = null;
        try { data = await res.json(); } catch (_) {}

        if (!res.ok) {
            const message = data?.error || `Request failed (${res.status})`;
            const err = new Error(message);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    window.api = api;

    // =========================================================
    // AUTH HELPERS
    // =========================================================

    async function getCurrentUser() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;

        const { data: profile, error } = await sb
            .from('profiles')
            .select('id, email, full_name, role, department, pairing_code')
            .eq('id', session.user.id)
            .single();

        if (error || !profile) return null;
        return { user: session.user, profile };
    }

    async function requireAuth() {
        const ctx = await getCurrentUser();
        if (!ctx) { window.location.href = '/login.html'; return null; }
        return ctx;
    }

    async function requireRole(...roles) {
        const ctx = await requireAuth();
        if (!ctx) return null;
        if (!roles.includes(ctx.profile.role)) {
            window.location.href = '/login.html';
            return null;
        }
        return ctx;
    }

    async function logout() {
        try { await sb.auth.signOut(); } catch (_) {}
        window.location.href = '/index.html';
    }

    window.getCurrentUser = getCurrentUser;
    window.requireAuth = requireAuth;
    window.requireRole = requireRole;
    window.logout = logout;

    // =========================================================
    // UTILITIES
    // =========================================================

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(input) {
        if (!input) return '—';
        const d = new Date(input);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    function formatDateTime(input) {
        if (!input) return '—';
        const d = new Date(input);
        if (isNaN(d)) return '—';
        return d.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function timeAgo(input) {
        if (!input) return '';
        const d = new Date(input);
        const sec = Math.floor((Date.now() - d) / 1000);
        if (sec < 60) return 'just now';
        if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
        if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
        if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
        return formatDate(input);
    }

    function initials(name) {
        if (!name) return '?';
        return String(name).trim().split(/\s+/).slice(0, 2)
            .map(s => s[0]).join('').toUpperCase();
    }

    window.escapeHTML = escapeHTML;
    window.formatDate = formatDate;
    window.formatDateTime = formatDateTime;
    window.timeAgo = timeAgo;
    window.initials = initials;

    // =========================================================
    // TOAST
    // =========================================================

    let toastContainer = null;

    function ensureToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'iv-toast-container';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function toast(message, type = 'info', duration = 3500) {
        const container = ensureToastContainer();
        const el = document.createElement('div');
        el.className = 'iv-toast iv-toast-' + type;
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        el.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${escapeHTML(message)}</span>
        `;
        container.appendChild(el);
        requestAnimationFrame(() => el.classList.add('iv-toast-show'));
        setTimeout(() => {
            el.classList.remove('iv-toast-show');
            setTimeout(() => el.remove(), 220);
        }, duration);
    }

    window.toast = toast;

    // =========================================================
    // MODAL / CONFIRM
    // =========================================================

    function closeModal() {
        const root = document.getElementById('iv-modal-root');
        if (!root) return;
        root.classList.remove('iv-modal-open');
        setTimeout(() => root.remove(), 180);
    }

    function openModal({ title, body, actions, wide = false }) {
        return new Promise(resolve => {
            const root = document.createElement('div');
            root.id = 'iv-modal-root';
            root.className = 'iv-modal-root';
            root.innerHTML = `
                <div class="iv-modal-backdrop"></div>
                <div class="iv-modal ${wide ? 'iv-modal-wide' : ''}" role="dialog" aria-modal="true">
                    <div class="iv-modal-header">
                        <h3>${escapeHTML(title || '')}</h3>
                        <button class="iv-modal-close" aria-label="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="iv-modal-body"></div>
                    <div class="iv-modal-footer"></div>
                </div>
            `;
            document.body.appendChild(root);

            const bodyEl = root.querySelector('.iv-modal-body');
            if (typeof body === 'string') bodyEl.innerHTML = body;
            else if (body instanceof Node) bodyEl.appendChild(body);

            const footer = root.querySelector('.iv-modal-footer');
            const acts = actions || [{ label: 'Close', variant: 'secondary', value: false }];
            acts.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'iv-btn iv-btn-' + (a.variant || 'secondary');
                btn.textContent = a.label;
                btn.onclick = () => {
                    if (a.onClick) a.onClick();
                    const value = a.value !== undefined ? a.value : true;
                    closeModal();
                    resolve(value);
                };
                footer.appendChild(btn);
            });

            root.querySelector('.iv-modal-close').onclick = () => { closeModal(); resolve(false); };
            root.querySelector('.iv-modal-backdrop').onclick = () => { closeModal(); resolve(false); };

            requestAnimationFrame(() => root.classList.add('iv-modal-open'));
        });
    }

    async function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
        return openModal({
            title,
            body: `<p class="iv-modal-text">${escapeHTML(message)}</p>`,
            actions: [
                { label: 'Cancel', variant: 'secondary', value: false },
                { label: confirmLabel, variant: danger ? 'danger' : 'primary', value: true }
            ]
        });
    }

    window.openModal = openModal;
    window.closeModal = closeModal;
    window.confirmDialog = confirmDialog;

    // =========================================================
    // NAV + SHELL
    // =========================================================

    const NAV = {
        student: [
            { href: '/student/dashboard.html',         icon: 'fa-th-large',   label: 'Dashboard' },
            { href: '/student/pairing.html',           icon: 'fa-link',       label: 'Supervisor Pairing' },
            { href: '/student/plagiarism-report.html', icon: 'fa-shield-alt', label: 'Plagiarism Scan' },
            { href: '/student/submit-topic.html',      icon: 'fa-paper-plane',label: 'Submit Topic' },
            { href: '/student/approval-status.html',   icon: 'fa-tasks',      label: 'Approval Status' },
            { href: '/student/messages.html',          icon: 'fa-comments',   label: 'Messages' },
            { href: '/student/profile.html',           icon: 'fa-user',       label: 'Profile' }
        ],
        supervisor: [
            { href: '/supervisor/dashboard.html',         icon: 'fa-th-large', label: 'Dashboard' },
            { href: '/supervisor/link-student.html',      icon: 'fa-link',     label: 'Link Student' },
            { href: '/supervisor/assigned-students.html', icon: 'fa-users',    label: 'My Students' },
            { href: '/supervisor/corpus.html',            icon: 'fa-database', label: 'Reference Corpus' },
            { href: '/supervisor/messages.html',          icon: 'fa-comments', label: 'Messages' }
        ],
        admin: [
            { href: '/admin/dashboard.html',        icon: 'fa-th-large',    label: 'Dashboard' },
            { href: '/admin/manage-users.html',     icon: 'fa-users-cog',   label: 'Users' },
            { href: '/admin/pairings.html',         icon: 'fa-link',        label: 'Pairings' },
            { href: '/admin/system-settings.html',  icon: 'fa-cog',         label: 'Settings' }
        ]
    };

    const ROLE_LABELS = {
        student: 'Student',
        supervisor: 'Supervisor',
        admin: 'Administrator'
    };

    async function renderShell({ ctx, activePath, title, subtitle, actions = '' }) {
        const { profile } = ctx;
        const role = profile.role;
        const nav = NAV[role] || [];

        const sidebarHTML = `
            <div class="iv-sidebar-inner">
                <div class="iv-sidebar-brand">
                    <div class="iv-sidebar-logo"><i class="fas fa-shield-alt"></i></div>
                    <div>
                        <div class="iv-sidebar-brand-name">IntelliVerify</div>
                        <div class="iv-sidebar-brand-role">${escapeHTML(ROLE_LABELS[role] || role)}</div>
                    </div>
                </div>
                <nav class="iv-sidebar-nav">
                    ${nav.map(item => {
                        const itemPath = item.href.replace(/\.html$/, '');
                        const active = activePath &&
                            (activePath === item.href || activePath.startsWith(itemPath));
                        return `
                            <a href="${item.href}" class="iv-nav-item ${active ? 'iv-nav-item-active' : ''}">
                                <i class="fas ${item.icon}"></i>
                                <span>${escapeHTML(item.label)}</span>
                            </a>
                        `;
                    }).join('')}
                </nav>
                <div class="iv-sidebar-footer">
                    <button class="iv-nav-item iv-nav-item-signout" id="iv-signout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Sign out</span>
                    </button>
                </div>
            </div>
        `;

        const topbarHTML = `
            <button class="iv-hamburger" id="iv-hamburger" aria-label="Menu">
                <i class="fas fa-bars"></i>
            </button>
            <div class="iv-topbar-title">
                <h1>${escapeHTML(title || '')}</h1>
                ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ''}
            </div>
            <div class="iv-topbar-actions">
                ${actions}
                <button class="iv-icon-btn iv-bell" id="iv-bell-btn" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="iv-bell-count" id="iv-bell-count" hidden>0</span>
                </button>
                <div class="iv-user-menu">
                    <button class="iv-user-btn" id="iv-user-btn">
                        <span class="iv-user-avatar">${escapeHTML(initials(profile.full_name || profile.email))}</span>
                        <span class="iv-user-name">${escapeHTML(profile.full_name || profile.email)}</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="iv-user-dropdown" id="iv-user-dropdown">
                        <div class="iv-user-dropdown-header">
                            <div class="iv-user-dropdown-name">${escapeHTML(profile.full_name || 'User')}</div>
                            <div class="iv-user-dropdown-email">${escapeHTML(profile.email)}</div>
                        </div>
                        <div class="iv-user-dropdown-body">
                            ${role === 'student' ? `<a href="/student/profile.html" class="iv-user-dropdown-item"><i class="fas fa-user"></i> Profile</a>` : ''}
                            <button class="iv-user-dropdown-item iv-user-dropdown-item-danger" id="iv-signout-btn-2">
                                <i class="fas fa-sign-out-alt"></i> Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const shell = document.getElementById('iv-shell');
        if (!shell) {
            console.error('[core] Missing #iv-shell container.');
            return null;
        }

        shell.innerHTML = `
            <aside class="iv-sidebar" id="iv-sidebar">${sidebarHTML}</aside>
            <div class="iv-sidebar-backdrop" id="iv-sidebar-backdrop"></div>
            <main class="iv-main">
                <header class="iv-topbar">${topbarHTML}</header>
                <div class="iv-content" id="iv-content"></div>
            </main>
        `;

        document.getElementById('iv-signout-btn').onclick = logout;
        const so2 = document.getElementById('iv-signout-btn-2');
        if (so2) so2.onclick = logout;

        const sidebar = document.getElementById('iv-sidebar');
        const backdrop = document.getElementById('iv-sidebar-backdrop');
        document.getElementById('iv-hamburger').onclick = () => {
            sidebar.classList.add('iv-sidebar-open');
            backdrop.classList.add('iv-sidebar-backdrop-open');
        };
        backdrop.onclick = () => {
            sidebar.classList.remove('iv-sidebar-open');
            backdrop.classList.remove('iv-sidebar-backdrop-open');
        };

        const userBtn = document.getElementById('iv-user-btn');
        const userDropdown = document.getElementById('iv-user-dropdown');
        userBtn.onclick = (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('iv-user-dropdown-open');
        };
        document.addEventListener('click', () => {
            userDropdown.classList.remove('iv-user-dropdown-open');
        });

        document.getElementById('iv-bell-btn').onclick = (e) => {
            e.stopPropagation();
            toggleNotificationsPanel();
        };

        startNotificationPolling();

        return document.getElementById('iv-content');
    }

    window.renderShell = renderShell;

    // =========================================================
    // NOTIFICATIONS
    // =========================================================

    let notifPanel = null;
    let notifPollTimer = null;

    async function updateBellCount() {
        try {
            const res = await api('/api/notifications/unread-count');
            const count = res.unread || 0;
            const badge = document.getElementById('iv-bell-count');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.hidden = false;
            } else {
                badge.hidden = true;
            }
        } catch (_) { /* silent */ }
    }

    async function toggleNotificationsPanel() {
        if (notifPanel) { notifPanel.remove(); notifPanel = null; return; }

        notifPanel = document.createElement('div');
        notifPanel.className = 'iv-notif-panel';
        notifPanel.innerHTML = `
            <div class="iv-notif-header">
                <span>Notifications</span>
                <button class="iv-notif-mark-all" id="iv-notif-mark-all">Mark all read</button>
            </div>
            <div class="iv-notif-list" id="iv-notif-list">
                <div class="iv-notif-empty"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        `;
        document.body.appendChild(notifPanel);

        const bellBtn = document.getElementById('iv-bell-btn');
        const rect = bellBtn.getBoundingClientRect();
        notifPanel.style.top = (rect.bottom + 8) + 'px';
        notifPanel.style.right = (window.innerWidth - rect.right) + 'px';

        let items = [];
        try {
            const res = await api('/api/notifications');
            items = res.notifications || [];
        } catch (_) {
            document.getElementById('iv-notif-list').innerHTML =
                `<div class="iv-notif-empty">Failed to load.</div>`;
            return;
        }

        renderNotifList(items);

        document.getElementById('iv-notif-mark-all').onclick = async () => {
            try { await api('/api/notifications/read-all', { method: 'POST' }); } catch (_) {}
            items = items.map(n => ({ ...n, is_read: true }));
            renderNotifList(items);
            updateBellCount();
        };

        setTimeout(() => {
            const handler = (e) => {
                if (notifPanel && !notifPanel.contains(e.target) &&
                    e.target.id !== 'iv-bell-btn' &&
                    !e.target.closest('#iv-bell-btn')) {
                    notifPanel.remove();
                    notifPanel = null;
                    document.removeEventListener('click', handler);
                }
            };
            document.addEventListener('click', handler);
        }, 0);
    }

    function renderNotifList(items) {
        const list = document.getElementById('iv-notif-list');
        if (!list) return;
        if (!items.length) {
            list.innerHTML = `<div class="iv-notif-empty">No notifications yet.</div>`;
            return;
        }
        list.innerHTML = items.map(n => `
            <div class="iv-notif-item ${n.is_read ? '' : 'iv-notif-item-unread'}"
                 data-id="${n.id}"
                 data-link="${escapeHTML(n.link || '')}">
                <div class="iv-notif-dot"></div>
                <div class="iv-notif-body">
                    <div class="iv-notif-title">${escapeHTML(n.title)}</div>
                    ${n.body ? `<div class="iv-notif-text">${escapeHTML(n.body)}</div>` : ''}
                    <div class="iv-notif-time">${escapeHTML(timeAgo(n.created_at))}</div>
                </div>
            </div>
        `).join('');

        // ---- FIXED: fire-and-forget read, navigate immediately ----
        list.querySelectorAll('.iv-notif-item').forEach(el => {
            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const id = el.dataset.id;
                const link = el.dataset.link;

                // Mark as read in background — do NOT await
                if (id) {
                    api(`/api/notifications/${id}/read`, { method: 'POST' })
                        .catch(() => {});
                }

                // Close panel immediately
                if (notifPanel) {
                    notifPanel.remove();
                    notifPanel = null;
                }

                // Navigate immediately (no await, no hang)
                if (link && link.length > 0) {
                    window.location.assign(link);
                } else {
                    updateBellCount();
                }
            };
        });
    }

    function startNotificationPolling() {
        updateBellCount();
        if (notifPollTimer) clearInterval(notifPollTimer);
        notifPollTimer = setInterval(updateBellCount, 30000);
    }

    // =========================================================
    // READY LOG
    // =========================================================

    console.log('[IntelliVerify] core.js ready.');
})();
