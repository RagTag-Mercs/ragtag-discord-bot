import type { UCIProfile } from "../oauth/uci.js";

export function checkBlocklist(
  orgs: UCIProfile["orgs"],
  blocklistJson: string
): boolean {
  const blocklist: string[] = JSON.parse(blocklistJson);
  if (blocklist.length === 0) return false;

  const blockedTags = new Set(blocklist.map((t) => t.toLowerCase()));
  return orgs.some((org) => blockedTags.has(org.tag.toLowerCase()));
}
