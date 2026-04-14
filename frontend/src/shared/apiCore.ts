export const TOKEN_STORAGE_KEY = "road700.access_token";

export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatApiErrorLocation(location: unknown): string | null {
  if (!Array.isArray(location)) {
    return null;
  }

  const parts = location
    .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const normalizedParts =
    parts.length > 1 && ["body", "query", "path", "header"].includes(parts[0].toLowerCase()) ? parts.slice(1) : parts;

  return normalizedParts.length > 0 ? normalizedParts.join(".") : null;
}

function formatApiDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string" && item.trim()) {
          return item;
        }
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const payload = item as Record<string, unknown>;
        const location = formatApiErrorLocation(payload.loc);
        const message =
          typeof payload.msg === "string" && payload.msg.trim()
            ? payload.msg
            : typeof payload.message === "string" && payload.message.trim()
              ? payload.message
              : "";

        if (location && message) {
          return `${location}: ${message}`;
        }
        if (message) {
          return message;
        }

        try {
          return JSON.stringify(payload);
        } catch {
          return null;
        }
      })
      .filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join("; ") : null;
  }
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return null;
  }

  const payload = detail as Record<string, unknown>;
  const dependency = typeof payload.dependency === "string" ? payload.dependency.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (dependency && message) {
    return `${dependency}: ${message}`;
  }
  if (message) {
    return message;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

export async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  return formatApiDetail(payload?.detail ?? payload) || `Ошибка запроса: ${response.status}`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  return (await response.json()) as T;
}
