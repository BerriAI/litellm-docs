import express, { type NextFunction, type Request, type Response } from "express";
import { signIn, signUp } from "./accounts.ts";
import { ask } from "./agent.ts";
import { accessToken, begin, connectionStatus, finish, GRANOLA, markConnection, type Customer } from "./connections.ts";
import { checkAccount } from "./mcp.ts";
import { createSession, deleteConnection, deleteSession, userForSession, type User } from "./store.ts";
import { page } from "./ui.ts";

const SESSION_COOKIE = "agent_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const app = express();
app.set("trust proxy", true);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

type Authed = Request & { user: User; customer: Customer };

function baseUrl(req: Request): string {
  return (process.env.APP_BASE_URL ?? `${req.protocol}://${req.get("x-forwarded-host") ?? req.get("host")}`).replace(/\/$/, "");
}

const callbackUrl = (req: Request) => `${baseUrl(req)}/oauth/callback`;

function sessionId(req: Request): string | undefined {
  const cookie = req.get("cookie") ?? "";
  return cookie
    .split(";")
    .map(part => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
}

function startSession(req: Request, res: Response, user: User): void {
  res.cookie(SESSION_COOKIE, createSession(user.id, SESSION_TTL_MS), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

function currentCustomer(req: Request): { user: User; customer: Customer } | undefined {
  const id = sessionId(req);
  const user = id ? userForSession(id) : undefined;
  return user && id ? { user, customer: { tenantId: user.tenantId, userId: user.id, sessionId: id } } : undefined;
}

function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  const current = currentCustomer(req);
  if (!current) {
    if (req.path.startsWith("/api/")) res.status(401).json({ error: "Sign in first." });
    else res.redirect("/");
    return;
  }
  Object.assign(req, current);
  next();
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function isUnauthorized(error: unknown): boolean {
  const text = message(error);
  return /401|unauthori[sz]ed|invalid_token/i.test(text) || (error instanceof Error && error.name === "UnauthorizedError");
}

async function verifyConnection(req: Authed): Promise<{ ok: true; account: string } | { ok: false; error: string }> {
  const token = await accessToken(req.customer, GRANOLA, callbackUrl(req));
  if (!token) return { ok: false, error: "Your Granola connection expired. Reconnect Granola." };
  try {
    const account = await checkAccount(GRANOLA, token);
    markConnection(req.customer, GRANOLA, "connected", account.slice(0, 500));
    return { ok: true, account };
  } catch (error) {
    if (isUnauthorized(error)) markConnection(req.customer, GRANOLA, "reconnect", null);
    return { ok: false, error: message(error) };
  }
}

app.get("/", (req, res) => {
  const current = currentCustomer(req);
  const notice = typeof req.query.notice === "string" ? req.query.notice : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  if (!current) return void res.type("html").send(page({ signedIn: false, notice, error }));
  const status = connectionStatus(current.customer, GRANOLA);
  res.type("html").send(page({ signedIn: true, user: current.user, connection: status, notice, error }));
});

app.post("/signup", (req, res) => {
  try {
    const user = signUp(String(req.body.company ?? ""), String(req.body.email ?? ""), String(req.body.password ?? ""));
    startSession(req, res, user);
    res.redirect("/");
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(message(error))}#signup`);
  }
});

app.post("/login", (req, res) => {
  try {
    startSession(req, res, signIn(String(req.body.email ?? ""), String(req.body.password ?? "")));
    res.redirect("/");
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(message(error))}`);
  }
});

app.post("/logout", (req, res) => {
  const id = sessionId(req);
  if (id) deleteSession(id);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect("/");
});

app.get("/connect/granola", requireCustomer, async (req, res) => {
  try {
    const authorizationUrl = await begin((req as Authed).customer, GRANOLA, callbackUrl(req));
    res.redirect(authorizationUrl.toString());
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(`Could not start the Granola sign-in: ${message(error)}`)}`);
  }
});

app.get("/oauth/callback", requireCustomer, async (req, res) => {
  const authed = req as Authed;
  const query = (name: string) => (typeof req.query[name] === "string" ? (req.query[name] as string) : undefined);
  try {
    await finish(authed.customer, GRANOLA, callbackUrl(req), {
      code: query("code"),
      state: query("state"),
      iss: query("iss"),
      error: query("error"),
    });
  } catch (error) {
    return void res.redirect(`/?error=${encodeURIComponent(message(error))}`);
  }
  const verified = await verifyConnection(authed);
  if (!verified.ok) return void res.redirect(`/?error=${encodeURIComponent(`Granola connected, but the account check failed: ${verified.error}`)}`);
  res.redirect(`/?notice=${encodeURIComponent("Granola is connected.")}`);
});

app.post("/disconnect/granola", requireCustomer, (req, res) => {
  const { customer } = req as Authed;
  deleteConnection(customer.tenantId, customer.userId, GRANOLA.name);
  res.redirect(`/?notice=${encodeURIComponent("Granola is disconnected.")}`);
});

app.post("/api/check", requireCustomer, async (req, res) => {
  const verified = await verifyConnection(req as Authed);
  res.status(verified.ok ? 200 : 409).json(verified);
});

app.post("/api/ask", requireCustomer, async (req, res) => {
  const authed = req as Authed;
  const question = String(req.body?.question ?? "").trim();
  if (!question) return void res.status(400).json({ error: "Ask a question about your meetings." });
  const status = connectionStatus(authed.customer, GRANOLA);
  if (status.status !== "connected") return void res.status(409).json({ error: "Connect Granola first." });
  const token = await accessToken(authed.customer, GRANOLA, callbackUrl(req));
  if (!token) return void res.status(409).json({ error: "Your Granola connection expired. Reconnect Granola.", reconnect: true });
  try {
    res.json(await ask(GRANOLA, token, question));
  } catch (error) {
    if (isUnauthorized(error)) {
      markConnection(authed.customer, GRANOLA, "reconnect", status.account);
      return void res.status(409).json({ error: "Granola rejected the saved token. Reconnect Granola.", reconnect: true });
    }
    res.status(502).json({ error: message(error) });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Meeting Agent listening on http://localhost:${port}`));
