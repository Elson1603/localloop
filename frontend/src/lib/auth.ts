type JwtPayload = {
  exp?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

export const clearAuthTokens = (): void => {
  localStorage.removeItem("localloop_access_token");
  localStorage.removeItem("localloop_id_token");
  localStorage.removeItem("localloop_refresh_token");
};

export const isTokenExpired = (token: string, skewSeconds = 30): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= payload.exp - skewSeconds;
};

const getValidToken = (key: string): string | null => {
  const token = localStorage.getItem(key);
  if (!token) {
    return null;
  }
  if (isTokenExpired(token)) {
    clearAuthTokens();
    return null;
  }
  return token;
};

export const getValidAccessToken = (): string | null => getValidToken("localloop_access_token");

export const getValidIdToken = (): string | null => getValidToken("localloop_id_token");
