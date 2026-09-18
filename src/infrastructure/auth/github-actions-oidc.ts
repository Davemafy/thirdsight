interface GitHubOidcHeader { alg?: unknown; kid?: unknown; typ?: unknown }
interface GitHubOidcClaims {
  iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown;
  repository?: unknown; ref?: unknown; workflow_ref?: unknown; event_name?: unknown;
}
interface Jwk { kid?: string; kty?: string; n?: string; e?: string; alg?: string; use?: string }
interface Jwks { keys?: Jwk[] }

const ISSUER = "https://token.actions.githubusercontent.com";
const REPOSITORY = "Davemafy/thirdsight";
let cachedJwks: { value: Jwks; expiresAt: number } | null = null;

export async function verifyGitHubActionsOidc(token: string, audience: string, workflowPath: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = parseJson<GitHubOidcHeader>(parts[0]);
    const claims = parseJson<GitHubOidcClaims>(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
    if (!validClaims(claims, audience, workflowPath)) return false;

    const jwks = await loadJwks();
    const jwk = jwks.keys?.find((key) => key.kid === header.kid);
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      toArrayBuffer(decodeBase64Url(parts[2])),
      toArrayBuffer(new TextEncoder().encode(`${parts[0]}.${parts[1]}`)),
    );
  } catch {
    return false;
  }
}

function validClaims(claims: GitHubOidcClaims, audience: string, workflowPath: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) return false;
  if (!hasAudience(claims.aud, audience)) return false;
  if (claims.repository !== REPOSITORY) return false;
  if (claims.ref !== "refs/heads/main") return false;
  if (claims.event_name !== "push") return false;
  if (
    typeof claims.workflow_ref !== "string" ||
    !claims.workflow_ref.includes(`${REPOSITORY}/${workflowPath}@refs/heads/main`)
  ) return false;
  if (typeof claims.exp !== "number" || claims.exp <= now - 30) return false;
  if (typeof claims.nbf === "number" && claims.nbf > now + 30) return false;
  return true;
}

function hasAudience(value: unknown, expected: string): boolean {
  if (value === expected) return true;
  return Array.isArray(value) && value.includes(expected);
}

async function loadJwks(): Promise<Jwks> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.value;
  const response = await fetch(`${ISSUER}/.well-known/jwks`, { cache: "no-store" });
  if (!response.ok) throw new Error("GitHub OIDC key discovery failed.");
  const value = (await response.json()) as Jwks;
  cachedJwks = { value, expiresAt: Date.now() + 10 * 60_000 };
  return value;
}

function parseJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}


export function verifyStage6GitHubOidc(token: string): Promise<boolean> {
  return verifyGitHubActionsOidc(token, "thirdsight-stage6", ".github/workflows/stage6-live-discovery.yml");
}
