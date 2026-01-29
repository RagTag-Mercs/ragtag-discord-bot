import { config } from "../config.js";
import { logger } from "../index.js";

// TODO: Update these URLs once uci.space API docs are provided
const UCI_AUTHORIZE_URL = "https://uci.space/oauth/authorize";
const UCI_TOKEN_URL = "https://uci.space/oauth/token";
const UCI_PROFILE_URL = "https://uci.space/api/profile";

export interface UCIProfile {
  handle: string;
  citizenRecord: string;
  orgs: { name: string; tag: string; rank: string }[];
  accountCreated: string;
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.uci.clientId,
    redirect_uri: config.uci.redirectUri,
    response_type: "code",
    state,
    scope: "profile organizations", // TODO: Confirm scopes with uci.space docs
  });

  return `${UCI_AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const response = await fetch(UCI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.uci.clientId,
      client_secret: config.uci.clientSecret,
      redirect_uri: config.uci.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Token exchange failed");
    throw new Error(`UCI token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchProfile(accessToken: string): Promise<UCIProfile> {
  const response = await fetch(UCI_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Profile fetch failed");
    throw new Error(`UCI profile fetch failed: ${response.status}`);
  }

  // TODO: Map response fields once uci.space API docs confirm the shape
  const data = (await response.json()) as UCIProfile;
  return data;
}
