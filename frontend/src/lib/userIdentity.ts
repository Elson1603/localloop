const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toText = (value: string | null | undefined): string => (typeof value === "string" ? value.trim() : "");

export const isUuidLike = (value: string | null | undefined): boolean => {
  const normalized = toText(value);
  return Boolean(normalized) && UUID_PATTERN.test(normalized);
};

export const isPlaceholderDisplayName = (displayName: string | null | undefined, email: string | null | undefined): boolean => {
  const normalized = toText(displayName).toLowerCase();
  if (!normalized || normalized === "localloop user" || normalized === "user") {
    return true;
  }
  if (isUuidLike(normalized)) {
    return true;
  }

  const emailPrefix = toText(email).split("@")[0]?.trim().toLowerCase();
  return Boolean(emailPrefix) && normalized === emailPrefix;
};

const humanizeIdentifier = (value: string | null | undefined): string => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }

  const identifier = raw.includes("@") ? raw.split("@")[0] : raw;
  const normalized = identifier.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || isUuidLike(normalized) || /^\d+$/.test(normalized)) {
    return "";
  }

  return normalized
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
};

export const resolveUsernameHandle = (username: string | null | undefined): string => {
  const raw = toText(username);
  if (!raw || isUuidLike(raw) || /^\d+$/.test(raw)) {
    return "";
  }

  const handle = raw.includes("@") ? raw.split("@")[0] : raw;
  const normalized = handle.replace(/\s+/g, "").trim();
  return normalized && !isUuidLike(normalized) ? normalized : "";
};

export const resolveDisplayName = (input: {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  fallback?: string;
}): string => {
  const fallback = toText(input.fallback) || "User";
  const directName = toText(input.displayName);

  if (directName && !isPlaceholderDisplayName(directName, input.email) && !isUuidLike(directName)) {
    return directName;
  }

  const byEmail = humanizeIdentifier(input.email);
  if (byEmail) {
    return byEmail;
  }

  const byUsername = humanizeIdentifier(input.username);
  if (byUsername) {
    return byUsername;
  }

  return fallback;
};
