import type { ResolvedGoogleChatAccount } from "./accounts.js";
import { findGoogleChatDirectMessage } from "./api.js";

const knownSpaceAliases = new Map<string, string>();

function normalizeAliasKey(raw?: string | null): string | undefined {
  const trimmed = raw?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

export function rememberGoogleChatSpaceAlias(params: {
  spaceId?: string | null;
  displayName?: string | null;
}) {
  const spaceId = params.spaceId?.trim();
  if (!spaceId) {
    return;
  }
  const displayKey = normalizeAliasKey(params.displayName);
  if (displayKey) {
    knownSpaceAliases.set(displayKey, spaceId);
  }
  // Also allow explicit targeting by raw space id with case-insensitive lookup.
  const idKey = normalizeAliasKey(spaceId);
  if (idKey) {
    knownSpaceAliases.set(idKey, spaceId);
  }
}

export function normalizeGoogleChatTarget(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const withoutPrefix = trimmed.replace(/^(googlechat|google-chat|gchat):/i, "");
  const normalized = withoutPrefix
    .replace(/^user:(users\/)?/i, "users/")
    .replace(/^space:(spaces\/)?/i, "spaces/");
  if (isGoogleChatUserTarget(normalized)) {
    const suffix = normalized.slice("users/".length);
    return suffix.includes("@") ? `users/${suffix.toLowerCase()}` : normalized;
  }
  if (isGoogleChatSpaceTarget(normalized)) {
    return normalized;
  }
  if (normalized.includes("@")) {
    return `users/${normalized.toLowerCase()}`;
  }
  const aliasKey = normalizeAliasKey(normalized);
  const resolvedAlias = aliasKey ? knownSpaceAliases.get(aliasKey) : undefined;
  if (resolvedAlias) {
    return resolvedAlias;
  }
  return normalized;
}

export function isGoogleChatUserTarget(value: string): boolean {
  return value.toLowerCase().startsWith("users/");
}

export function isGoogleChatSpaceTarget(value: string): boolean {
  return value.toLowerCase().startsWith("spaces/");
}

function stripMessageSuffix(target: string): string {
  const index = target.indexOf("/messages/");
  if (index === -1) {
    return target;
  }
  return target.slice(0, index);
}

export async function resolveGoogleChatOutboundSpace(params: {
  account: ResolvedGoogleChatAccount;
  target: string;
}): Promise<string> {
  const normalized = normalizeGoogleChatTarget(params.target);
  if (!normalized) {
    throw new Error("Missing Google Chat target.");
  }
  const base = stripMessageSuffix(normalized);
  if (isGoogleChatSpaceTarget(base)) {
    return base;
  }
  if (isGoogleChatUserTarget(base)) {
    const dm = await findGoogleChatDirectMessage({
      account: params.account,
      userName: base,
    });
    if (!dm?.name) {
      throw new Error(`No Google Chat DM found for ${base}`);
    }
    return dm.name;
  }
  return base;
}
