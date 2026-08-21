import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GdprBanner, { hasGdprConsent } from "../../src/components/GdprBanner";
import { I18nProvider } from "../../src/i18n";

const GDPR_KEY = "gdpr_consent_v1";

const renderBanner = () =>
  render(
    <I18nProvider defaultLang="en">
      <GdprBanner />
    </I18nProvider>,
  );

// ---------------------------------------------------------------------------
// hasGdprConsent utility
// ---------------------------------------------------------------------------
describe("hasGdprConsent()", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns false when the localStorage key is absent", () => {
    expect(hasGdprConsent()).toBe(false);
  });

  it('returns true when the key is set to "accepted"', () => {
    localStorage.setItem(GDPR_KEY, "accepted");
    expect(hasGdprConsent()).toBe(true);
  });

  it('returns false for any value other than "accepted"', () => {
    localStorage.setItem(GDPR_KEY, "dismissed");
    expect(hasGdprConsent()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GdprBanner visibility
// ---------------------------------------------------------------------------
describe("GdprBanner – visibility", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders the banner when no consent is stored", () => {
    renderBanner();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it('does not render the banner when consent is already "accepted"', () => {
    localStorage.setItem(GDPR_KEY, "accepted");
    renderBanner();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GdprBanner – accept interaction
// ---------------------------------------------------------------------------
describe("GdprBanner – accept interaction", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("hides the banner after the accept button is clicked", async () => {
    const user = userEvent.setup();
    renderBanner();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it('persists "accepted" in localStorage after clicking accept', async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: /ok/i }));

    expect(localStorage.getItem(GDPR_KEY)).toBe("accepted");
  });
});
