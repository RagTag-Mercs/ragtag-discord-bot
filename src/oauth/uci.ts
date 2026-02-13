import { randomBytes, createHash } from "node:crypto";
import { config } from "../config.js";
import { logger } from "../index.js";

const UCI_BASE = "https://uci.space";
const UCI_OIDC_DISCOVERY = `${UCI_BASE}/.well-known/openid-configuration`;
const UCI_AUTHORIZE_URL = `${UCI_BASE}/oauth2/authorize`;
const UCI_TOKEN_URL = `${UCI_BASE}/api/v1/oauth2/token`;

// Discovered at runtime from OIDC config
let cachedUserinfoUrl: string | null = null;

async function getUserinfoUrl(): Promise<string> {
  if (cachedUserinfoUrl) return cachedUserinfoUrl;

  const res = await fetch(UCI_OIDC_DISCOVERY);
  if (res.ok) {
    const config = (await res.json()) as { userinfo_endpoint?: string };
    if (config.userinfo_endpoint) {
      cachedUserinfoUrl = config.userinfo_endpoint;
      logger.info({ userinfo_endpoint: cachedUserinfoUrl }, "Discovered OIDC userinfo endpoint");
      return cachedUserinfoUrl;
    }
  }

  // Fallback to common OIDC path
  cachedUserinfoUrl = `${UCI_BASE}/oauth2/userinfo`;
  return cachedUserinfoUrl;
}

export interface UCIProfile {
  handle: string;
  citizenRecord: string;
  orgs: { name: string; tag: string; rank: string }[];
  accountCreated: string;
}

// PKCE helpers
function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// Store code verifiers keyed by state so we can retrieve them at callback time
const pkceStore = new Map<string, string>();

export function getAuthorizeUrl(state: string): string {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  pkceStore.set(state, codeVerifier);

  const params = new URLSearchParams({
    client_id: config.uci.clientId,
    redirect_uri: config.uci.redirectUri,
    response_type: "code",
    state,
    scope: "openid profile rsi",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${UCI_AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode(code: string, state: string): Promise<string> {
  const codeVerifier = pkceStore.get(state);
  pkceStore.delete(state);

  const body: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: config.uci.clientId,
    redirect_uri: config.uci.redirectUri,
    code,
  };

  // Include client_secret for confidential clients
  if (config.uci.clientSecret) {
    body.client_secret = config.uci.clientSecret;
  }

  // Include PKCE verifier if we have one
  if (codeVerifier) {
    body.code_verifier = codeVerifier;
  }

  const response = await fetch(UCI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Token exchange failed");
    throw new Error(`UCI token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  logger.info({ token_response: data }, "Raw token exchange response");

  // Decode id_token JWT payload to see what claims UCI includes
  if (typeof data.id_token === "string" && data.id_token.length > 0) {
    try {
      const payload = JSON.parse(
        Buffer.from(data.id_token.split(".")[1], "base64url").toString()
      );
      logger.info({ id_token_claims: payload }, "Decoded id_token");
    } catch (e) {
      logger.warn({ err: e }, "Could not decode id_token");
    }
  } else {
    logger.info("No id_token in token response");
  }

  // Also try decoding the access_token in case it's a JWT with claims
  const accessToken = data.access_token as string;
  if (accessToken.includes(".")) {
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64url").toString()
      );
      logger.info({ access_token_claims: payload }, "Decoded access_token JWT");
    } catch {
      // Not a JWT, that's fine
    }
  }

  return accessToken;
}

export async function fetchProfile(accessToken: string): Promise<UCIProfile | null> {
  const userinfoUrl = await getUserinfoUrl();
  const response = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Profile fetch failed");
    throw new Error(`UCI profile fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  logger.info({ userinfo: data }, "UCI userinfo response received");

  // The rsi scope provides linked RSI account data
  const rsi = (data.rsi ?? null) as Record<string, unknown> | null;

  if (!rsi || !rsi.handle) {
    logger.info("User has not linked their RSI account on UCI");
    return null;
  }

  return {
    handle: rsi.handle as string,
    citizenRecord: (rsi.citizen_record as string) ?? "",
    orgs: Array.isArray(rsi.orgs) ? rsi.orgs : [],
    accountCreated: (rsi.account_created as string) ?? "",
  };
}
