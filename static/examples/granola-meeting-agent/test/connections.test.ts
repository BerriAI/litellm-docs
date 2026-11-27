import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.APP_SECRET = "test-secret";
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "meeting-agent-")), "app.db");

const { signIn, signUp } = await import("../src/accounts.ts");
const { accessToken, finish, GRANOLA, connectionStatus } = await import("../src/connections.ts");
const store = await import("../src/store.ts");

const callback = "http://localhost:3000/oauth/callback";

function customerFor(email: string, company: string) {
  const user = signUp(company, email, "password123");
  return { tenantId: user.tenantId, userId: user.id, sessionId: store.createSession(user.id, 60_000) };
}

test("sign-in checks the password", () => {
  signUp("Initech", "peter@initech.test", "password123");
  assert.equal(signIn("peter@initech.test", "password123").email, "peter@initech.test");
  assert.throws(() => signIn("peter@initech.test", "wrong-password"));
  assert.throws(() => signUp("Initech", "peter@initech.test", "password123"));
});

test("the callback rejects a state that belongs to another session", async () => {
  const alice = customerFor("alice@acme.test", "Acme");
  const bob = customerFor("bob@globex.test", "Globex");
  store.savePending(alice.sessionId, GRANOLA.name, "alice-state");
  await assert.rejects(finish(bob, GRANOLA, callback, { code: "c", state: "alice-state" }), /does not match/);
  await assert.rejects(finish(alice, GRANOLA, callback, { code: "c", state: "forged" }), /does not match/);
  assert.equal(store.loadPending(alice.sessionId, GRANOLA.name)?.state, "alice-state");
});

test("each customer gets only their own encrypted connection", async () => {
  const carol = customerFor("carol@umbrella.test", "Umbrella");
  const dave = customerFor("dave@hooli.test", "Hooli");
  store.saveConnection(carol.tenantId, carol.userId, GRANOLA.name, {
    data: { tokens: { access_token: "carol-token-plaintext", token_type: "Bearer" }, tokensSavedAt: Date.now() },
    status: "connected",
    account: "carol",
  });
  assert.equal(await accessToken(carol, GRANOLA, callback), "carol-token-plaintext");
  assert.equal(await accessToken(dave, GRANOLA, callback), undefined);
  assert.equal(connectionStatus(dave, GRANOLA).status, "none");
  assert.ok(!readFileSync(process.env.DATABASE_PATH!).includes("carol-token-plaintext"));
});

test("an expired token without a refresh token asks the customer to reconnect", async () => {
  const erin = customerFor("erin@stark.test", "Stark");
  store.saveConnection(erin.tenantId, erin.userId, GRANOLA.name, {
    data: { tokens: { access_token: "old", token_type: "Bearer", expires_in: 60 }, tokensSavedAt: Date.now() - 3_600_000 },
    status: "connected",
    account: "erin",
  });
  assert.equal(await accessToken(erin, GRANOLA, callback), undefined);
  assert.equal(connectionStatus(erin, GRANOLA).status, "reconnect");
});
