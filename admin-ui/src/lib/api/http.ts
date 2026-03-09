export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
let csrfBootstrapPromise: Promise<string | null> | null = null;

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function extractMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    const msg = data.error ?? data.message;
    if (typeof msg === 'string' && msg.trim().length > 0) {
      return msg;
    }
  }
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }
  return `Request failed (${status})`;
}

function readCookie(name: string): string | null {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) {
    return null;
  }
  const value = cookie.slice(name.length + 1);
  return value.length > 0 ? decodeURIComponent(value) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existingToken = readCookie('XSRF-TOKEN');
  if (existingToken) {
    return existingToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        const payload = await readBody(response);
        if (payload && typeof payload === 'object') {
          const token = (payload as Record<string, unknown>).token;
          if (typeof token === 'string' && token.trim().length > 0) {
            return token;
          }
        }
        return readCookie('XSRF-TOKEN');
      })
      .catch(() => null)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? {});

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken && !headers.has('X-XSRF-TOKEN')) {
      headers.set('X-XSRF-TOKEN', csrfToken);
    }
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  });

  const body = await readBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(response.status, body), body);
  }

  return body as T;
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function postJson<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

export function putJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
  });
}

export function postForm<T>(path: string, form: URLSearchParams | FormData): Promise<T> {
  const headers =
    form instanceof URLSearchParams ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined;

  return request<T>(path, {
    method: 'POST',
    headers,
    body: form,
  });
}
