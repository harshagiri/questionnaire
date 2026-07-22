export function sanitizeMagicLinkToken(raw: string | null | undefined) {
  const compact = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!compact) {
    return "";
  }

  // Keep only URL-safe token characters and strip surrounding punctuation.
  const cleaned = compact.replace(/^[^A-Za-z0-9_-]+|[^A-Za-z0-9_-]+$/g, "");
  return cleaned;
}

export function extractMagicLinkToken(url: URL) {
  const fromNamedParam =
    sanitizeMagicLinkToken(url.searchParams.get("t")) ||
    sanitizeMagicLinkToken(url.searchParams.get("token"));

  if (fromNamedParam) {
    return fromNamedParam;
  }

  // Some SMS apps transform /m/<token> into /m/?<token> (query key with no value).
  const firstKey = url.searchParams.keys().next().value;
  const fromFirstKey = sanitizeMagicLinkToken(typeof firstKey === "string" ? firstKey : "");
  if (fromFirstKey && fromFirstKey !== "t" && fromFirstKey !== "token") {
    return fromFirstKey;
  }

  return "";
}
