import React from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "../../src/i18n";
import AuthModal from "../../src/components/AuthModal";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted to top level
// ---------------------------------------------------------------------------
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  authApi: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
  documentApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { useAuth } from "../../src/contexts/AuthContext";

const makeAuthMock = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
  login: vi.fn().mockResolvedValue({ success: true }),
  register: vi.fn().mockResolvedValue({ success: true }),
  error: null as string | null,
  clearError: vi.fn(),
  loading: false,
  user: null,
  isAuthenticated: false,
  isGuest: false,
  logout: vi.fn(),
  logoutAllDevices: vi.fn(),
  startGuestMode: vi.fn(),
  exitGuestMode: vi.fn(),
  documentList: [],
  currentDocumentId: null,
  saveDocument: vi.fn(),
  loadDocument: vi.fn(),
  createNewDocument: vi.fn(),
  deleteDocument: vi.fn(),
  refreshDocumentList: vi.fn(),
  renameDocument: vi.fn(),
  setCurrentDocumentId: vi.fn(),
  updatePreferences: vi.fn(),
  deleteAccount: vi.fn(),
  ...overrides,
});

const renderModal = (
  props: Partial<React.ComponentProps<typeof AuthModal>> = {},
) => {
  const defaults: React.ComponentProps<typeof AuthModal> = {
    isOpen: true,
    onClose: vi.fn(),
    ...props,
  };
  return render(
    <I18nProvider defaultLang="en">
      <AuthModal {...defaults} />
    </I18nProvider>,
  );
};

beforeEach(() => {
  (useAuth as Mock).mockReturnValue(makeAuthMock());
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------
describe("AuthModal – visibility", () => {
  it("renders nothing when isOpen is false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when isOpen is true", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Login mode
// ---------------------------------------------------------------------------
describe("AuthModal – login mode", () => {
  it("shows the login heading by default", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  });

  it("renders email and password fields", () => {
    renderModal();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("does not render the username field in login mode", () => {
    renderModal();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("calls login with email and password on submit", async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    (useAuth as Mock).mockReturnValue(makeAuthMock({ login }));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test@example.com", "secret123");
    });
  });

  it("calls onSuccess after a successful login", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const login = vi.fn().mockResolvedValue({ success: true });
    (useAuth as Mock).mockReturnValue(makeAuthMock({ login }));
    renderModal({ onSuccess, onClose });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when login succeeds and no onSuccess is provided", async () => {
    const onClose = vi.fn();
    const login = vi.fn().mockResolvedValue({ success: true });
    (useAuth as Mock).mockReturnValue({
      login,
      register: vi.fn().mockResolvedValue({ success: true }),
      error: null,
      clearError: vi.fn(),
      loading: false,
      user: null,
      isAuthenticated: false,
    });
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays the auth context error message", () => {
    (useAuth as Mock).mockReturnValue(
      makeAuthMock({ error: "Invalid credentials" }),
    );
    renderModal();
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Register mode
// ---------------------------------------------------------------------------
describe("AuthModal – register mode", () => {
  const switchToRegister = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /sign up/i }));
  };

  it("shows username and confirm-password fields in register mode", async () => {
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.type(screen.getByLabelText("Confirm Password"), "different");
    await user.click(screen.getByRole("checkbox")); // GDPR consent
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("shows an error when the password is shorter than 6 characters", async () => {
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "12345");
    await user.type(screen.getByLabelText("Confirm Password"), "12345");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it("shows an error when the username is shorter than 3 characters", async () => {
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Username"), "ab");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.type(screen.getByLabelText("Confirm Password"), "pass123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it("shows an error when the GDPR consent checkbox is not ticked", async () => {
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.type(screen.getByLabelText("Confirm Password"), "pass123");
    // Deliberately skip checking the GDPR box
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/must accept the privacy policy/i),
      ).toBeInTheDocument();
    });
  });

  it("calls register with email, username, and password on valid submission", async () => {
    const register = vi.fn().mockResolvedValue({ success: true });
    (useAuth as Mock).mockReturnValue(makeAuthMock({ register }));
    const user = userEvent.setup();
    renderModal();
    await switchToRegister(user);

    await user.type(screen.getByLabelText("Email"), "new@user.com");
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.type(screen.getByLabelText("Confirm Password"), "pass123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        "new@user.com",
        "newuser",
        "pass123",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Keyboard and overlay interactions
// ---------------------------------------------------------------------------
describe("AuthModal – keyboard and overlay", () => {
  it("calls onClose when the Escape key is pressed", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the overlay is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider defaultLang="en">
        <AuthModal isOpen onClose={onClose} />
      </I18nProvider>,
    );

    const overlay = document.querySelector(
      ".auth-modal-overlay",
    ) as HTMLElement;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
