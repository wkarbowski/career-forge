import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getToken,
  setToken,
  removeToken,
  getAccessToken,
  removeTokens,
  setTokens,
  authApi,
} from "../../src/services/api";

const ACCESS_KEY = "cv_auth_token";
const EXPIRES_KEY = "cv_token_expires";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------
describe("Token management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getToken returns null when no token is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores the token under the correct localStorage key", () => {
    setToken("tok-abc");
    expect(localStorage.getItem(ACCESS_KEY)).toBe("tok-abc");
  });

  it("getToken retrieves the stored token", () => {
    setToken("tok-abc");
    expect(getToken()).toBe("tok-abc");
  });

  it("getAccessToken is an alias that retrieves the stored access token", () => {
    setToken("tok-xyz");
    expect(getAccessToken()).toBe("tok-xyz");
  });

  it("removeToken clears the stored token", () => {
    setToken("tok-abc");
    removeToken();
    expect(getToken()).toBeNull();
  });

  it("setTokens stores access token and computes expiry when expiresIn is provided", () => {
    setTokens("acc-123", null, 3600);
    expect(localStorage.getItem(ACCESS_KEY)).toBe("acc-123");
    const stored = localStorage.getItem(EXPIRES_KEY);
    expect(stored).not.toBeNull();
    // Expiry should be in the future (roughly now + 3600s - 30s grace)
    expect(Number(stored)).toBeGreaterThan(Date.now());
  });

  it("setTokens does not write an expiry entry when expiresIn is null", () => {
    setTokens("acc-456", null, null);
    expect(localStorage.getItem(ACCESS_KEY)).toBe("acc-456");
    expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
  });

  it("removeTokens clears both the access token and expiry", () => {
    setTokens("acc-789", null, 3600);
    removeTokens();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// authApi.isAuthenticated
// ---------------------------------------------------------------------------
describe("authApi.isAuthenticated", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when no token is stored", () => {
    expect(authApi.isAuthenticated()).toBe(false);
  });

  it("returns true when an access token is present in localStorage", () => {
    setToken("active-token");
    expect(authApi.isAuthenticated()).toBe(true);
  });

  it("returns false after the token has been removed", () => {
    setToken("active-token");
    removeToken();
    expect(authApi.isAuthenticated()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// authApi.login
// ---------------------------------------------------------------------------
describe("authApi.login", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the access token in localStorage on a successful response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "login-token", expires_in: 3600 }),
    } as Response);

    await authApi.login("user@example.com", "password123");
    expect(getToken()).toBe("login-token");
  });

  it("throws with the server detail message on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Invalid credentials" }),
    } as Response);

    await expect(
      authApi.login("user@example.com", "wrong-pass"),
    ).rejects.toThrow("Invalid credentials");
  });

  it("formats a FastAPI validation-error array into a readable message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        detail: [{ loc: ["body", "email"], msg: "field required" }],
      }),
    } as Response);

    await expect(authApi.login("", "pass")).rejects.toThrow(
      "body.email: field required",
    );
  });

  it("does not alter the token when login fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Bad credentials" }),
    } as Response);

    await expect(authApi.login("x@x.com", "bad")).rejects.toThrow();
    expect(getToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// authApi.logout
// ---------------------------------------------------------------------------
describe("authApi.logout", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setToken("active-session-token");
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the access token from localStorage after a successful server call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    await authApi.logout();
    expect(getToken()).toBeNull();
  });

  it("still removes the token even when the server request fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await authApi.logout();
    expect(getToken()).toBeNull();
  });
});
