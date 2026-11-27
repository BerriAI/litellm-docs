import type { User } from "./store.ts";

type PageState =
  | { signedIn: false; notice?: string; error?: string }
  | {
      signedIn: true;
      user: User;
      connection: { status: string; account: string | null };
      notice?: string;
      error?: string;
    };

const escape = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const styles = `
:root { --bg: #f7f8fc; --surface: #fff; --text: #14161f; --text-muted: #14161f8f; --border: #14161f1a;
  --accent: #0117be; --accent-fg: #fff; --danger: #b42318; --ok: #067647; --radius: 10px;
  --font: Geist, Inter, ui-sans-serif, system-ui, sans-serif; --mono: "Geist Mono", ui-monospace, Menlo, monospace; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 var(--font); }
header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
header strong { font-size: 17px; }
main { max-width: 880px; margin: 32px auto; padding: 0 20px; display: grid; gap: 20px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; box-shadow: 0 1px 3px #14161f0d; }
h1 { font-size: 28px; margin: 0 0 6px; } h2 { font-size: 18px; margin: 0 0 12px; }
.muted { color: var(--text-muted); }
.grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
label { display: block; font-size: 13px; font-weight: 500; margin: 12px 0 4px; }
input, textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font: inherit; background: var(--surface); }
textarea { min-height: 80px; resize: vertical; }
button, .button { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 8px; padding: 10px 16px; font: inherit; font-weight: 600;
  background: var(--accent); color: var(--accent-fg); cursor: pointer; text-decoration: none; }
button.secondary, .button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
button:disabled { opacity: .6; cursor: progress; }
form { margin: 0; } .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 16px; }
.banner { padding: 12px 16px; border-radius: 8px; border: 1px solid; }
.banner.error { color: var(--danger); border-color: #b4231840; background: #b423180a; }
.banner.notice { color: var(--ok); border-color: #06764740; background: #0676470a; }
.integration { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); }
.pill.connected { color: var(--ok); border-color: #06764755; } .pill.reconnect { color: var(--danger); border-color: #b4231855; }
pre, .account { font: 12px/1.5 var(--mono); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; margin: 12px 0 0; }
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.suggestions button { font-weight: 500; font-size: 13px; padding: 6px 12px; }
.answer { white-space: pre-wrap; margin-top: 16px; }
.steps { margin-top: 16px; font-size: 13px; } .steps details { margin-top: 6px; }
footer { text-align: center; padding: 24px; font-size: 13px; } footer a { color: var(--text-muted); }
`;

function signedOut(): string {
  return `
  <section class="card">
    <h1>Ask your meetings anything</h1>
    <p class="muted">Meeting Agent connects to your Granola account and answers questions about your meetings. Create an account or sign in, then connect Granola.</p>
  </section>
  <div class="grid">
    <form class="card" method="post" action="/login">
      <h2>Sign in</h2>
      <label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="email" required>
      <label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required>
      <div class="row"><button type="submit">Sign in</button></div>
    </form>
    <form class="card" id="signup" method="post" action="/signup">
      <h2>Create an account</h2>
      <label for="company">Company</label><input id="company" name="company" autocomplete="organization" required>
      <label for="signup-email">Email</label><input id="signup-email" name="email" type="email" autocomplete="email" required>
      <label for="signup-password">Password</label><input id="signup-password" name="password" type="password" minlength="8" autocomplete="new-password" required>
      <div class="row"><button type="submit">Create account</button></div>
    </form>
  </div>`;
}

function signedIn(connection: { status: string; account: string | null }): string {
  const connected = connection.status === "connected";
  const label = connected ? "Connected" : connection.status === "reconnect" ? "Reconnect needed" : connection.status === "pending" ? "Not verified" : "Not connected";
  const actions = connected
    ? `<button type="button" class="secondary" id="check">Check connection</button>
       <form method="post" action="/disconnect/granola"><button class="secondary" type="submit">Disconnect</button></form>`
    : `<a class="button" href="/connect/granola">${connection.status === "none" ? "Connect Granola" : "Reconnect Granola"}</a>`;
  return `
  <section class="card">
    <div class="integration">
      <div>
        <h2>Granola</h2>
        <div class="muted">Your meeting notes and transcripts. Sign in with your own Granola account.</div>
      </div>
      <span class="pill ${connected ? "connected" : connection.status === "reconnect" ? "reconnect" : ""}" id="status">${label}</span>
    </div>
    ${connected && connection.account ? `<div class="account" id="account">${escape(connection.account)}</div>` : ""}
    <div class="row">${actions}</div>
  </section>
  <section class="card">
    <h2>Ask about your meetings</h2>
    ${connected ? "" : `<p class="muted">Connect Granola to start asking questions.</p>`}
    <form id="ask">
      <textarea id="question" name="question" placeholder="What did we decide in my last meeting?" ${connected ? "" : "disabled"}></textarea>
      <div class="suggestions">
        ${["What were my last three meetings about?", "List the action items assigned to me this week.", "Summarize what I discussed with customers recently."]
          .map(text => `<button type="button" class="secondary" data-suggestion="${escape(text)}" ${connected ? "" : "disabled"}>${escape(text)}</button>`)
          .join("")}
      </div>
      <div class="row"><button type="submit" id="ask-button" ${connected ? "" : "disabled"}>Ask</button></div>
    </form>
    <div id="result"></div>
  </section>`;
}

const script = `
const $ = id => document.getElementById(id);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
document.querySelectorAll("[data-suggestion]").forEach(b => b.addEventListener("click", () => { $("question").value = b.dataset.suggestion; $("question").focus(); }));
$("check")?.addEventListener("click", async e => {
  e.target.disabled = true; e.target.textContent = "Checking...";
  const res = await fetch("/api/check", { method: "POST" });
  const body = await res.json();
  if (body.ok) location.href = "/?notice=" + encodeURIComponent("Granola connection verified.");
  else location.href = "/?error=" + encodeURIComponent(body.error);
});
$("ask")?.addEventListener("submit", async e => {
  e.preventDefault();
  const question = $("question").value.trim();
  if (!question) return;
  const button = $("ask-button"); button.disabled = true; button.textContent = "Thinking...";
  $("result").innerHTML = '<p class="muted">Searching your meetings...</p>';
  try {
    const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const body = await res.json();
    if (!res.ok) {
      $("result").innerHTML = '<div class="banner error" style="margin-top:16px">' + escapeHtml(body.error) + (body.reconnect ? ' <a href="/connect/granola">Reconnect Granola</a>' : "") + "</div>";
      return;
    }
    const steps = body.steps.map(s => '<details><summary>' + (s.isError ? "Failed: " : "Called ") + '<code>' + escapeHtml(s.tool) + '</code></summary><pre>' + escapeHtml(JSON.stringify(s.arguments, null, 2)) + "\\n\\n" + escapeHtml(s.preview) + "</pre></details>").join("");
    $("result").innerHTML = '<div class="answer">' + escapeHtml(body.answer) + "</div>" + (steps ? '<div class="steps muted">Tool calls through LiteLLM MCP Gateway' + steps + "</div>" : "");
  } catch (err) {
    $("result").innerHTML = '<div class="banner error" style="margin-top:16px">' + escapeHtml(err.message) + "</div>";
  } finally { button.disabled = false; button.textContent = "Ask"; }
});
`;

export function page(state: PageState): string {
  const banner = state.error
    ? `<div class="banner error">${escape(state.error)}</div>`
    : state.notice
      ? `<div class="banner notice">${escape(state.notice)}</div>`
      : "";
  const account = state.signedIn
    ? `<div class="row" style="margin:0"><span class="muted">${escape(state.user.email)}</span>
       <form method="post" action="/logout"><button class="secondary" type="submit">Sign out</button></form></div>`
    : "";
  const footer = process.env.APP_FOOTER_URL ? `<footer><a href="${escape(process.env.APP_FOOTER_URL)}">Request changes</a></footer>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meeting Agent</title><style>${styles}</style></head>
<body>
<header><strong>Meeting Agent</strong>${account}</header>
<main>${banner}${state.signedIn ? signedIn(state.connection) : signedOut()}</main>
${footer}
<script>${script}</script>
</body></html>`;
}
