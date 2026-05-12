import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, useTranslation } from "../src/i18n";

// ---------------------------------------------------------------------------
// Helper: tiny component that exposes translation state to the DOM
// ---------------------------------------------------------------------------
const TranslationDisplay = ({ tKey }: { tKey: string }) => {
  const { t } = useTranslation();
  return <span data-testid="result">{t(tKey)}</span>;
};

const LangDisplay = () => {
  const { lang, setLang, availableLanguages } = useTranslation();
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <span data-testid="available">{availableLanguages.join(",")}</span>
      {availableLanguages.map((l) => (
        <button key={l} onClick={() => setLang(l)}>
          {l}
        </button>
      ))}
    </div>
  );
};

const wrap = (ui: React.ReactElement) =>
  render(<I18nProvider defaultLang="en">{ui}</I18nProvider>);

// ---------------------------------------------------------------------------
// Translation lookup
// ---------------------------------------------------------------------------
describe("t() – translation lookup", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns the correct English string for a known top-level-nested key", () => {
    wrap(<TranslationDisplay tKey="nav.editor" />);
    expect(screen.getByTestId("result")).toHaveTextContent("Editor");
  });

  it("returns the correct string for another known key", () => {
    wrap(<TranslationDisplay tKey="nav.dashboard" />);
    expect(screen.getByTestId("result")).toHaveTextContent("My Documents");
  });

  it("returns the key itself when the key does not exist in the locale", () => {
    wrap(<TranslationDisplay tKey="this.key.does.not.exist" />);
    expect(screen.getByTestId("result")).toHaveTextContent(
      "this.key.does.not.exist",
    );
  });

  it("returns the key when only part of the path exists", () => {
    wrap(<TranslationDisplay tKey="nav.nonexistent" />);
    expect(screen.getByTestId("result")).toHaveTextContent("nav.nonexistent");
  });

  it("handles deeply nested keys correctly", () => {
    wrap(<TranslationDisplay tKey="auth.passwordsNoMatch" />);
    expect(screen.getByTestId("result")).toHaveTextContent(
      "Passwords do not match",
    );
  });
});

// ---------------------------------------------------------------------------
// Language switching
// ---------------------------------------------------------------------------
describe("Language switching", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to English", () => {
    wrap(<LangDisplay />);
    expect(screen.getByTestId("current-lang")).toHaveTextContent("en");
  });

  it("lists both English and German as available languages", () => {
    wrap(<LangDisplay />);
    const available = screen.getByTestId("available").textContent ?? "";
    expect(available).toContain("en");
    expect(available).toContain("de");
  });

  it("switches the active language when setLang is called", async () => {
    const user = userEvent.setup();
    wrap(<LangDisplay />);

    await user.click(screen.getByRole("button", { name: "de" }));
    expect(screen.getByTestId("current-lang")).toHaveTextContent("de");
  });

  it("persists the selected language to localStorage", async () => {
    const user = userEvent.setup();
    wrap(<LangDisplay />);

    await user.click(screen.getByRole("button", { name: "de" }));
    expect(localStorage.getItem("career-forge-lang")).toBe("de");
  });

  it("translates a key into German after switching language", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider defaultLang="en">
        <LangDisplay />
        <TranslationDisplay tKey="nav.templates" />
      </I18nProvider>,
    );

    // English first
    expect(screen.getByTestId("result")).toHaveTextContent("Templates");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "de" }));
    });

    // German: "Vorlagen"
    expect(screen.getByTestId("result")).toHaveTextContent("Vorlagen");
  });

  it("ignores setLang for unsupported locale codes", async () => {
    const user = userEvent.setup();

    const TryBadLang = () => {
      const { lang, setLang } = useTranslation();
      return (
        <div>
          <span data-testid="lang">{lang}</span>
          <button onClick={() => setLang("xx")}>set-xx</button>
        </div>
      );
    };

    render(
      <I18nProvider defaultLang="en">
        <TryBadLang />
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "set-xx" }));
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });
});
