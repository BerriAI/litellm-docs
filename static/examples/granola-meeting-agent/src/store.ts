import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const secret = process.env.APP_SECRET;
if (!secret) throw new Error("Set APP_SECRET to encrypt stored connections.");
const encryptionKey = createHash("sha256").update(secret).digest();

const databasePath = process.env.DATABASE_PATH ?? "data/app.db";
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oauth_pending (
    session_id TEXT NOT NULL,
    server TEXT NOT NULL,
    state TEXT NOT NULL,
    code_verifier TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, server)
  );
  CREATE TABLE IF NOT EXISTS connections (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    server TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT NOT NULL,
    account TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, user_id, server)
  );
`);

function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString("base64")).join(".");
}

function decrypt<T>(value: string): T {
  const [iv, tag, body] = value.split(".").map(part => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as T;
}

export type User = { id: string; tenantId: string; email: string };
type UserRow = { id: string; tenant_id: string; email: string; password_hash: string };

const toUser = (row: UserRow): User => ({ id: row.id, tenantId: row.tenant_id, email: row.email });

export function createUser(tenantId: string, email: string, passwordHash: string): User {
  const id = randomBytes(12).toString("hex");
  db.prepare("INSERT INTO users (id, tenant_id, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, tenantId, email, passwordHash, Date.now());
  return { id, tenantId, email };
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | undefined {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row && { ...toUser(row), passwordHash: row.password_hash };
}

export function createSession(userId: string, ttlMs: number): string {
  const id = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, Date.now() + ttlMs);
  return id;
}

export function userForSession(sessionId: string): User | undefined {
  const row = db
    .prepare("SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?")
    .get(sessionId, Date.now()) as UserRow | undefined;
  return row && toUser(row);
}

export function deleteSession(sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  db.prepare("DELETE FROM oauth_pending WHERE session_id = ?").run(sessionId);
}

export type Pending = { state: string; codeVerifier?: string; createdAt: number };
type PendingRow = { state: string; code_verifier: string | null; created_at: number };

export function savePending(sessionId: string, server: string, state: string): void {
  db.prepare(
    "INSERT OR REPLACE INTO oauth_pending (session_id, server, state, code_verifier, created_at) VALUES (?, ?, ?, NULL, ?)",
  ).run(sessionId, server, state, Date.now());
}

export function savePendingVerifier(sessionId: string, server: string, codeVerifier: string): void {
  db.prepare("UPDATE oauth_pending SET code_verifier = ? WHERE session_id = ? AND server = ?")
    .run(encrypt(codeVerifier), sessionId, server);
}

export function loadPending(sessionId: string, server: string): Pending | undefined {
  const row = db.prepare("SELECT * FROM oauth_pending WHERE session_id = ? AND server = ?").get(sessionId, server) as
    | PendingRow
    | undefined;
  if (!row) return undefined;
  return {
    state: row.state,
    codeVerifier: row.code_verifier ? decrypt<string>(row.code_verifier) : undefined,
    createdAt: row.created_at,
  };
}

export function deletePending(sessionId: string, server: string): void {
  db.prepare("DELETE FROM oauth_pending WHERE session_id = ? AND server = ?").run(sessionId, server);
}

export type ConnectionStatus = "pending" | "connected" | "reconnect";
export type ConnectionRecord<T> = { data: T; status: ConnectionStatus; account: string | null; updatedAt: number };
type ConnectionRow = { data: string; status: ConnectionStatus; account: string | null; updated_at: number };

export function loadConnection<T>(tenantId: string, userId: string, server: string): ConnectionRecord<T> | undefined {
  const row = db
    .prepare("SELECT data, status, account, updated_at FROM connections WHERE tenant_id = ? AND user_id = ? AND server = ?")
    .get(tenantId, userId, server) as ConnectionRow | undefined;
  return row && { data: decrypt<T>(row.data), status: row.status, account: row.account, updatedAt: row.updated_at };
}

export function saveConnection<T>(
  tenantId: string,
  userId: string,
  server: string,
  record: { data: T; status: ConnectionStatus; account: string | null },
): void {
  db.prepare(
    `INSERT INTO connections (tenant_id, user_id, server, data, status, account, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, user_id, server) DO UPDATE SET data = excluded.data, status = excluded.status,
     account = excluded.account, updated_at = excluded.updated_at`,
  ).run(tenantId, userId, server, encrypt(record.data), record.status, record.account, Date.now());
}

export function deleteConnection(tenantId: string, userId: string, server: string): void {
  db.prepare("DELETE FROM connections WHERE tenant_id = ? AND user_id = ? AND server = ?").run(tenantId, userId, server);
}
