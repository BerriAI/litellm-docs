import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createUser, findUserByEmail, type User } from "./store.ts";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("base64")}.${scryptSync(password, salt, 32).toString("base64")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(".").map(part => Buffer.from(part, "base64"));
  return timingSafeEqual(scryptSync(password, salt, 32), hash);
}

function tenantIdFor(company: string): string {
  return company.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function signUp(company: string, email: string, password: string): User {
  const tenantId = tenantIdFor(company);
  const normalized = email.trim().toLowerCase();
  if (!tenantId) throw new Error("Enter your company name.");
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
  if (findUserByEmail(normalized)) throw new Error("An account with this email already exists. Sign in instead.");
  return createUser(tenantId, normalized, hashPassword(password));
}

export function signIn(email: string, password: string): User {
  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || !passwordMatches(password, user.passwordHash)) throw new Error("Email or password is incorrect.");
  return { id: user.id, tenantId: user.tenantId, email: user.email };
}
