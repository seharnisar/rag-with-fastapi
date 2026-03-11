import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:8000";

// ── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Tiny hook for localStorage token ─────────────────────────────────────────
function useAuth() {
  const [token, setToken] = useState(() => sessionStorage.getItem("token") || null);
  const login = (t) => { sessionStorage.setItem("token", t); setToken(t); };
  const logout = () => { sessionStorage.removeItem("token"); setToken(null); };
  return { token, login, logout };
}

// ── Icons (inline SVG, no deps) ───────────────────────────────────────────────
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const BotIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M12 2a3 3 0 0 1 3 3v6H9V5a3 3 0 0 1 3-3z" /><circle cx="9" cy="17" r="1" fill="currentColor" /><circle cx="15" cy="17" r="1" fill="currentColor" />
  </svg>
);

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0d0f12;
    --surface:  #13161b;
    --border:   #1e2229;
    --border2:  #262b34;
    --accent:   #e8ff47;
    --accent2:  #47c8ff;
    --text:     #e8eaf0;
    --muted:    #636878;
    --user-bg:  #1a1f28;
    --bot-bg:   #111418;
    --danger:   #ff4757;
    --success:  #2ecc71;
    --font:     'Syne', sans-serif;
    --mono:     'DM Mono', monospace;
  }

  html, body, #root { height: 100%; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  /* ── AUTH PAGE ── */
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    position: relative;
    overflow: hidden;
  }
  .auth-page::before {
    content: '';
    position: absolute;
    width: 600px; height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(232,255,71,0.06) 0%, transparent 70%);
    top: -200px; left: -200px;
    pointer-events: none;
  }
  .auth-page::after {
    content: '';
    position: absolute;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(71,200,255,0.05) 0%, transparent 70%);
    bottom: -100px; right: -100px;
    pointer-events: none;
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    padding: 48px 40px;
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 2px;
    position: relative;
    z-index: 1;
    animation: fadeUp 0.4s ease;
  }
  .auth-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
  }

  .auth-logo {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 32px;
    font-family: var(--mono);
  }

  .auth-title {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  .auth-subtitle {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 36px;
    font-family: var(--mono);
  }

  .field { margin-bottom: 18px; }
  .field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
    font-family: var(--mono);
  }
  .field input {
    width: 100%;
    padding: 12px 14px;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 2px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  .field input:focus { border-color: var(--accent); }
  .field input::placeholder { color: var(--muted); }

  .btn-primary {
    width: 100%;
    padding: 13px;
    background: var(--accent);
    color: #0d0f12;
    border: none;
    border-radius: 2px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    margin-top: 8px;
  }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .auth-switch {
    margin-top: 24px;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
    font-family: var(--mono);
  }
  .auth-switch button {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 500;
    text-decoration: underline;
  }

  .error-msg {
    padding: 10px 14px;
    background: rgba(255,71,87,0.1);
    border: 1px solid rgba(255,71,87,0.3);
    border-radius: 2px;
    color: var(--danger);
    font-size: 13px;
    font-family: var(--mono);
    margin-bottom: 18px;
  }
  .success-msg {
    padding: 10px 14px;
    background: rgba(46,204,113,0.1);
    border: 1px solid rgba(46,204,113,0.3);
    border-radius: 2px;
    color: var(--success);
    font-size: 13px;
    font-family: var(--mono);
    margin-bottom: 18px;
  }

  /* ── APP LAYOUT ── */
  .app-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100vh;
    overflow: hidden;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    font-family: var(--mono);
    margin-bottom: 4px;
  }
  .sidebar-tagline {
    font-size: 11px;
    color: var(--muted);
    font-family: var(--mono);
  }

  .sidebar-section {
    padding: 20px 20px 0;
    flex: 1;
    overflow-y: auto;
  }
  .sidebar-section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--mono);
    margin-bottom: 12px;
  }

  /* Upload zone */
  .upload-zone {
    border: 1.5px dashed var(--border2);
    border-radius: 2px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    margin-bottom: 16px;
    position: relative;
  }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--accent); background: rgba(232,255,71,0.03); }
  .upload-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .upload-zone-icon { color: var(--muted); margin-bottom: 8px; }
  .upload-zone-text { font-size: 12px; color: var(--muted); font-family: var(--mono); line-height: 1.5; }
  .upload-zone-text span { color: var(--accent); }

  .upload-progress {
    margin-bottom: 12px;
  }
  .upload-progress-bar {
    height: 2px;
    background: var(--border2);
    border-radius: 1px;
    overflow: hidden;
    margin-top: 6px;
  }
  .upload-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    border-radius: 1px;
    animation: progressPulse 1.5s ease infinite;
  }
  .upload-progress-text {
    font-size: 11px;
    color: var(--muted);
    font-family: var(--mono);
  }

  /* Document list */
  .doc-list { display: flex; flex-direction: column; gap: 6px; }
  .doc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 2px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--text);
    transition: border-color 0.15s;
  }
  .doc-item:hover { border-color: var(--border2); }
  .doc-item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }
  .doc-status {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .doc-status.ready { background: rgba(46,204,113,0.15); color: var(--success); }
  .doc-status.processing { background: rgba(232,255,71,0.1); color: var(--accent); }
  .doc-status.failed { background: rgba(255,71,87,0.1); color: var(--danger); }
  .doc-delete {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 2px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .doc-delete:hover { color: var(--danger); }
  .doc-empty {
    font-size: 12px;
    color: var(--muted);
    font-family: var(--mono);
    text-align: center;
    padding: 16px 0;
    line-height: 1.6;
  }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }
  .user-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .user-avatar {
    width: 28px; height: 28px;
    border-radius: 2px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #0d0f12;
    flex-shrink: 0;
  }
  .user-email {
    flex: 1;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .logout-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: 2px;
    transition: color 0.15s;
  }
  .logout-btn:hover { color: var(--danger); }

  /* ── CHAT AREA ── */
  .chat-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .chat-topbar {
    padding: 16px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .chat-topbar-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
    flex-shrink: 0;
  }
  .chat-topbar-dot.offline { background: var(--muted); box-shadow: none; }
  .chat-topbar-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .chat-topbar-sub {
    font-size: 11px;
    color: var(--muted);
    font-family: var(--mono);
    margin-left: auto;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    scroll-behavior: smooth;
  }
  .chat-messages::-webkit-scrollbar { width: 4px; }
  .chat-messages::-webkit-scrollbar-track { background: transparent; }
  .chat-messages::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* Empty state */
  .chat-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--muted);
    text-align: center;
    padding: 40px;
  }
  .chat-empty-icon {
    width: 56px; height: 56px;
    border: 1.5px solid var(--border2);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .chat-empty-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.02em;
  }
  .chat-empty-sub {
    font-size: 13px;
    font-family: var(--mono);
    color: var(--muted);
    line-height: 1.6;
    max-width: 320px;
  }
  .chat-empty-hints {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    width: 100%;
    max-width: 360px;
  }
  .hint-chip {
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 2px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--muted);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, color 0.15s;
  }
  .hint-chip:hover { border-color: var(--accent); color: var(--text); }

  /* Messages */
  .msg { display: flex; gap: 12px; animation: fadeUp 0.2s ease; max-width: 780px; }
  .msg.user { align-self: flex-end; flex-direction: row-reverse; }
  .msg.assistant { align-self: flex-start; }

  .msg-avatar {
    width: 28px; height: 28px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .msg.user .msg-avatar { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #0d0f12; font-size: 11px; font-weight: 800; }
  .msg.assistant .msg-avatar { background: var(--surface); border: 1px solid var(--border2); color: var(--muted); }

  .msg-body { display: flex; flex-direction: column; gap: 4px; max-width: calc(100% - 40px); }

  .msg-bubble {
    padding: 12px 16px;
    border-radius: 2px;
    font-size: 14px;
    line-height: 1.65;
    border: 1px solid transparent;
  }
  .msg.user .msg-bubble {
    background: var(--user-bg);
    border-color: var(--border2);
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
  }
  .msg.assistant .msg-bubble {
    background: var(--bot-bg);
    border-color: var(--border);
    color: var(--text);
    white-space: pre-wrap;
  }

  .msg-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .source-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(71,200,255,0.08);
    border: 1px solid rgba(71,200,255,0.2);
    border-radius: 2px;
    font-size: 10px;
    font-family: var(--mono);
    color: var(--accent2);
  }

  .msg-time {
    font-size: 10px;
    color: var(--muted);
    font-family: var(--mono);
    padding: 0 4px;
  }
  .msg.user .msg-time { text-align: right; }

  /* Thinking indicator */
  .thinking { display: flex; gap: 4px; align-items: center; padding: 14px 16px; }
  .thinking span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--muted);
    animation: bounce 1.2s ease infinite;
  }
  .thinking span:nth-child(2) { animation-delay: 0.15s; }
  .thinking span:nth-child(3) { animation-delay: 0.3s; }

  /* ── CHAT INPUT ── */
  .chat-input-area {
    padding: 20px 28px 24px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .chat-input-wrap {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 2px;
    padding: 12px 14px;
    transition: border-color 0.15s;
  }
  .chat-input-wrap:focus-within { border-color: var(--accent); }
  .chat-input-wrap textarea {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    resize: none;
    min-height: 20px;
    max-height: 120px;
    line-height: 1.5;
  }
  .chat-input-wrap textarea::placeholder { color: var(--muted); }
  .send-btn {
    width: 34px; height: 34px;
    background: var(--accent);
    border: none;
    border-radius: 2px;
    color: #0d0f12;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s, transform 0.1s;
  }
  .send-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

  .chat-input-hint {
    font-size: 10px;
    color: var(--muted);
    font-family: var(--mono);
    margin-top: 8px;
    text-align: center;
  }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40%           { transform: translateY(-6px); }
  }
  @keyframes progressPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true);
    try {
      if (mode === "register") {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        setSuccess("Account created! You can now log in.");
        setMode("login");
        setPassword("");
      } else {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);
        const data = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form
        }).then(r => r.json());
        if (!data.access_token) throw new Error(data.detail || "Login failed");
        onLogin(data.access_token, email);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">◈ DocChat</div>
        <div className="auth-title">{mode === "login" ? "Welcome back." : "Create account."}</div>
        <div className="auth-subtitle">
          {mode === "login" ? "Sign in to chat with your documents" : "Upload PDFs and ask anything"}
        </div>
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} />
        </div>
        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in →" : "Create account →"}
        </button>
        <div className="auth-switch">
          {mode === "login" ? <>No account? <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}>Register</button></> : <>Have an account? <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Sign in</button></>}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ token, email, onLogout, onDocsChange }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const pollRef = useRef(null);

  const fetchDocs = async () => {
    try {
      const data = await apiFetch("/documents/", {}, token);
      setDocs(data);
      onDocsChange(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchDocs();
    pollRef.current = setInterval(fetchDocs, 4000);
    return () => clearInterval(pollRef.current);
  }, [token]);

  const uploadFile = async (file) => {
    if (!file || !file.name.endsWith(".pdf")) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      await fetchDocs();
    } catch (_) {}
    setUploading(false);
  };

  const deleteDoc = async (id) => {
    await apiFetch(`/documents/${id}`, { method: "DELETE" }, token);
    fetchDocs();
  };

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">◈ DocChat</div>
        <div className="sidebar-tagline">RAG · Powered by llama3</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Documents</div>

        <div
          className={`upload-zone ${drag ? "drag" : ""}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); uploadFile(e.dataTransfer.files[0]); }}
        >
          <input type="file" accept=".pdf" onChange={e => uploadFile(e.target.files[0])} />
          <div className="upload-zone-icon"><UploadIcon /></div>
          <div className="upload-zone-text">
            <span>Click or drag</span> a PDF here<br />to add it to your knowledge base
          </div>
        </div>

        {uploading && (
          <div className="upload-progress">
            <div className="upload-progress-text">Uploading & processing...</div>
            <div className="upload-progress-bar"><div className="upload-progress-fill" style={{ width: "100%" }} /></div>
          </div>
        )}

        <div className="doc-list">
          {docs.length === 0 && !uploading && (
            <div className="doc-empty">No documents yet.<br />Upload a PDF to get started.</div>
          )}
          {docs.map(doc => (
            <div className="doc-item" key={doc.id}>
              <FileIcon />
              <span className="doc-item-name" title={doc.filename}>{doc.filename}</span>
              <span className={`doc-status ${doc.status}`}>{doc.status}</span>
              <button className="doc-delete" onClick={() => deleteDoc(doc.id)}><TrashIcon /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar">{initial}</div>
          <div className="user-email">{email}</div>
          <button className="logout-btn" onClick={onLogout} title="Sign out"><LogoutIcon /></button>
        </div>
      </div>
    </div>
  );
}

// ── Chat Area ─────────────────────────────────────────────────────────────────
const HINTS = [
  "Summarise the key points of my document",
  "What are the main conclusions?",
  "List the important dates or figures mentioned",
];

function ChatArea({ token, email, docs }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const hasReadyDoc = docs.some(d => d.status === "ready");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const history = messages
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg = { role: "user", content: q, time: new Date() };
    const assistantMsg = { role: "assistant", content: "", sources: [], time: new Date() };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (done) break;

        const chunk = decoder.decode(result.value, { stream: true });
        accumulated += chunk;

        const textSoFar = accumulated;
        setMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
            updated[lastIndex] = { ...updated[lastIndex], content: textSoFar };
          }
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ ${e.message}`,
        sources: [],
        time: new Date(),
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const fmt = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="chat-area">
      <div className="chat-topbar">
        <div className={`chat-topbar-dot ${hasReadyDoc ? "" : "offline"}`} />
        <div className="chat-topbar-title">Chat</div>
        <div className="chat-topbar-sub">
          {hasReadyDoc ? `${docs.filter(d => d.status === "ready").length} doc(s) ready` : "No documents ready"}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <div className="chat-empty-icon"><BotIcon /></div>
            <div className="chat-empty-title">Ask your documents anything.</div>
            <div className="chat-empty-sub">
              {hasReadyDoc
                ? "Your documents are ready. Ask a question below."
                : "Upload a PDF on the left to get started."}
            </div>
            {hasReadyDoc && (
              <div className="chat-empty-hints">
                {HINTS.map(h => (
                  <button key={h} className="hint-chip" onClick={() => send(h)}>{h}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            <div className="msg-avatar">
              {msg.role === "user" ? initial : <BotIcon />}
            </div>
            <div className="msg-body">
              <div className="msg-bubble">
                {msg.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="msg-sources">
                  {msg.sources.map(s => (
                    <span key={s} className="source-chip"><FileIcon />{s}</span>
                  ))}
                </div>
              )}
              <div className="msg-time">{fmt(msg.time)}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg assistant">
            <div className="msg-avatar"><BotIcon /></div>
            <div className="msg-body">
              <div className="msg-bubble">
                <div className="thinking">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={hasReadyDoc ? "Ask a question about your documents..." : "Upload a PDF first..."}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKey}
            disabled={!hasReadyDoc || loading}
          />
          <button className="send-btn" onClick={() => send()} disabled={!input.trim() || !hasReadyDoc || loading}>
            <SendIcon />
          </button>
        </div>
        <div className="chat-input-hint">Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { token, login, logout } = useAuth();
  const [email, setEmail] = useState(() => sessionStorage.getItem("email") || "");
  const [docs, setDocs] = useState([]);

  const handleLogin = (t, e) => {
    login(t);
    setEmail(e);
    sessionStorage.setItem("email", e);
  };

  const handleLogout = () => {
    logout();
    setEmail("");
    sessionStorage.removeItem("email");
  };

  return (
    <>
      <style>{css}</style>
      {!token ? (
        <AuthPage onLogin={handleLogin} />
      ) : (
        <div className="app-layout">
          <Sidebar token={token} email={email} onLogout={handleLogout} onDocsChange={setDocs} />
          <ChatArea token={token} email={email} docs={docs} />
        </div>
      )}
    </>
  );
}