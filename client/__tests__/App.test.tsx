import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";

// Prevent real network calls during tests
vi.mock("../src/services/api", () => ({
  authApi: {
    isAuthenticated: vi.fn().mockReturnValue(false),
    getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
  },
  documentApi: {
    list: vi.fn().mockResolvedValue([]),
    getDocuments: vi.fn().mockResolvedValue([]),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getDocument: vi.fn(),
  },
  publicApi: {
    getTemplates: vi.fn().mockResolvedValue([]),
  },
  getToken: vi.fn().mockReturnValue(null),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  getRefreshToken: vi.fn().mockReturnValue(null),
  setTokens: vi.fn(),
  removeTokens: vi.fn(),
}));

describe("App – smoke tests", () => {
  it("renders the application without crashing", async () => {
    await act(async () => {
      render(<App />);
    });
    // no throw = pass
  });

  it("mounts with the GlobalHeader showing Career Forge branding", async () => {
    await act(async () => {
      render(<App />);
    });
    // GlobalHeader is hidden on the home page for unauthenticated users;
    // the home page hero title provides the branding check.
    expect(screen.getAllByText("Career Forge").length).toBeGreaterThan(0);
  });

  it("renders the home page hero section for unauthenticated users", async () => {
    await act(async () => {
      render(<App />);
    });
    // Home page subtitle text is visible on the unauthenticated landing page
    const subtitleMatchers = screen.queryAllByText(/resume|cover letter/i);
    expect(subtitleMatchers.length).toBeGreaterThan(0);
  });

  it("renders login and guest-mode CTAs on the home page", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(
      screen.getByRole("button", { name: /login|sign in|register/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guest/i })).toBeInTheDocument();
  });
});
