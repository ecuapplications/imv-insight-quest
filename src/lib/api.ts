const API_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "admin_token";

export type ApiResult<T> = { data: T | null; error: string | null };

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res
    .json()
    .catch(() => ({ data: null, error: "Respuesta inválida del servidor" }));

  if (!res.ok) {
    return { data: null, error: body.error || `Error ${res.status}` };
  }
  return body as ApiResult<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function login(
  email: string,
  password: string
): Promise<ApiResult<{ token: string; email: string }>> {
  const result = await api.post<{ token: string; email: string }>("/auth/login.php", {
    email,
    password,
  });
  if (result.data) setToken(result.data.token);
  return result;
}

export function logout() {
  setToken(null);
}
