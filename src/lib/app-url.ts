function parseForwardedHeader(value: string | null) {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function getSafeConfiguredOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (!configured) {
    return null;
  }

  try {
    const parsed = new URL(configured);
    if (process.env.NODE_ENV === "production" && isLoopbackHost(parsed.hostname)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveAppUrl(request: Request) {
  const configuredOrigin = getSafeConfiguredOrigin();

  const incoming = new URL(request.url);
  const forwardedHost = parseForwardedHeader(request.headers.get("x-forwarded-host"));
  const forwardedProto = parseForwardedHeader(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost || request.headers.get("host") || incoming.host;
  const proto = forwardedProto || incoming.protocol.replace(":", "");

  if (host) {
    const candidate = `${proto}://${host}`;
    try {
      const parsed = new URL(candidate);
      if (!(process.env.NODE_ENV === "production" && isLoopbackHost(parsed.hostname))) {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid host/proto combinations and continue to fallback.
    }
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return incoming.origin;
}
