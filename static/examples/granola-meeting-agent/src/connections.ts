import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  auth,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import {
  deletePending,
  loadConnection,
  loadPending,
  saveConnection,
  savePending,
  savePendingVerifier,
  type ConnectionRecord,
  type ConnectionStatus,
} from "./store.ts";

export type Customer = { tenantId: string; userId: string; sessionId: string };

export type McpServer = { name: string; label: string; oauthUrl: string };

export const GRANOLA: McpServer = { name: "granola", label: "Granola", oauthUrl: "https://mcp.granola.ai/mcp" };

type ConnectionData = {
  clientInformation?: StoredOAuthClientInformation;
  discoveryState?: OAuthDiscoveryState;
  tokens?: StoredOAuthTokens;
  tokensSavedAt?: number;
};

const PENDING_TTL_MS = 10 * 60 * 1000;
const EXPIRY_MARGIN_MS = 60 * 1000;

class ConnectionProvider implements OAuthClientProvider {
  authorizationUrl?: URL;

  constructor(
    private readonly customer: Customer,
    private readonly server: McpServer,
    private readonly callbackUrl: string,
    private readonly oauthState?: string,
  ) {}

  private record(): ConnectionRecord<ConnectionData> | undefined {
    return loadConnection<ConnectionData>(this.customer.tenantId, this.customer.userId, this.server.name);
  }

  private update(change: Partial<ConnectionData>): void {
    const current = this.record();
    saveConnection(this.customer.tenantId, this.customer.userId, this.server.name, {
      data: { ...current?.data, ...change },
      status: current?.status ?? "pending",
      account: current?.account ?? null,
    });
  }

  get redirectUrl(): string {
    return this.callbackUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Meeting Agent",
      redirect_uris: [this.callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  state(): string {
    if (!this.oauthState) throw new Error("Start the connection from the Connect button.");
    return this.oauthState;
  }

  clientInformation(): StoredOAuthClientInformation | undefined {
    const info = this.record()?.data.clientInformation;
    const redirectUris = (info as { redirect_uris?: string[] } | undefined)?.redirect_uris;
    if (redirectUris && !redirectUris.includes(this.callbackUrl)) return undefined;
    return info;
  }

  saveClientInformation(clientInformation: StoredOAuthClientInformation): void {
    this.update({ clientInformation });
  }

  tokens(): StoredOAuthTokens | undefined {
    return this.record()?.data.tokens;
  }

  saveTokens(tokens: StoredOAuthTokens): void {
    this.update({ tokens, tokensSavedAt: Date.now() });
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.record()?.data.discoveryState;
  }

  saveDiscoveryState(discoveryState: OAuthDiscoveryState): void {
    this.update({ discoveryState });
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.authorizationUrl = authorizationUrl;
  }

  saveCodeVerifier(codeVerifier: string): void {
    savePendingVerifier(this.customer.sessionId, this.server.name, codeVerifier);
  }

  codeVerifier(): string {
    const verifier = loadPending(this.customer.sessionId, this.server.name)?.codeVerifier;
    if (!verifier) throw new Error("The sign-in attempt expired. Connect again.");
    return verifier;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    if (scope === "all") return this.update({ clientInformation: undefined, tokens: undefined, discoveryState: undefined });
    if (scope === "client") return this.update({ clientInformation: undefined });
    if (scope === "tokens") return this.update({ tokens: undefined });
    if (scope === "discovery") return this.update({ discoveryState: undefined });
    deletePending(this.customer.sessionId, this.server.name);
  }
}

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function connectionStatus(customer: Customer, server: McpServer): { status: ConnectionStatus | "none"; account: string | null } {
  const record = loadConnection<ConnectionData>(customer.tenantId, customer.userId, server.name);
  if (!record?.data.tokens) return { status: "none", account: null };
  return { status: record.status, account: record.account };
}

export function markConnection(customer: Customer, server: McpServer, status: ConnectionStatus, account: string | null): void {
  const record = loadConnection<ConnectionData>(customer.tenantId, customer.userId, server.name);
  if (!record) return;
  saveConnection(customer.tenantId, customer.userId, server.name, { data: record.data, status, account });
}

export async function begin(customer: Customer, server: McpServer, callbackUrl: string): Promise<URL> {
  const state = randomBytes(32).toString("base64url");
  savePending(customer.sessionId, server.name, state);
  const provider = new ConnectionProvider(customer, server, callbackUrl, state);
  const result = await auth(provider, { serverUrl: server.oauthUrl, forceReauthorization: true });
  if (result !== "REDIRECT" || !provider.authorizationUrl) throw new Error(`${server.label} did not return a sign-in URL.`);
  return provider.authorizationUrl;
}

export async function finish(
  customer: Customer,
  server: McpServer,
  callbackUrl: string,
  params: { code?: string; state?: string; iss?: string; error?: string },
): Promise<void> {
  const pending = loadPending(customer.sessionId, server.name);
  if (params.error) {
    deletePending(customer.sessionId, server.name);
    throw new Error(`${server.label} sign-in was not completed (${params.error}).`);
  }
  if (!pending || !params.state || !sameValue(pending.state, params.state)) {
    throw new Error("The sign-in response does not match this session. Connect again.");
  }
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
    deletePending(customer.sessionId, server.name);
    throw new Error("The sign-in attempt expired. Connect again.");
  }
  if (!params.code) throw new Error(`${server.label} did not return an authorization code.`);
  const provider = new ConnectionProvider(customer, server, callbackUrl);
  try {
    await auth(provider, { serverUrl: server.oauthUrl, authorizationCode: params.code, iss: params.iss });
  } finally {
    deletePending(customer.sessionId, server.name);
  }
  markConnection(customer, server, "pending", null);
}

export async function accessToken(customer: Customer, server: McpServer, callbackUrl: string): Promise<string | undefined> {
  const record = loadConnection<ConnectionData>(customer.tenantId, customer.userId, server.name);
  const tokens = record?.data.tokens;
  if (!record || !tokens) return undefined;
  const expiresAt = tokens.expires_in && record.data.tokensSavedAt ? record.data.tokensSavedAt + tokens.expires_in * 1000 : undefined;
  if (!expiresAt || expiresAt - EXPIRY_MARGIN_MS > Date.now()) return tokens.access_token;
  if (!tokens.refresh_token) {
    markConnection(customer, server, "reconnect", record.account);
    return undefined;
  }
  const provider = new ConnectionProvider(customer, server, callbackUrl);
  try {
    const result = await auth(provider, { serverUrl: server.oauthUrl });
    if (result === "AUTHORIZED") return provider.tokens()?.access_token;
  } catch (error) {
    console.warn(`Refreshing the ${server.label} token failed:`, error instanceof Error ? error.message : error);
  }
  markConnection(customer, server, "reconnect", record.account);
  return undefined;
}
