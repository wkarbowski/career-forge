import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KeywordMatcher from "../../src/components/KeywordMatcher";
import { I18nProvider } from "../../src/i18n";

const renderMatcher = (resumeText = "") =>
  render(
    <I18nProvider defaultLang="en">
      <KeywordMatcher resumeText={resumeText} />
    </I18nProvider>,
  );

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
describe("KeywordMatcher – initial state", () => {
  it("renders the job description textarea", () => {
    renderMatcher();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the Analyze button in a disabled state when the textarea is empty", () => {
    renderMatcher();
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("enables the Analyze button once text is entered", async () => {
    const user = userEvent.setup();
    renderMatcher();

    await user.type(screen.getByRole("textbox"), "JavaScript developer needed");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Analysis – score calculation
// ---------------------------------------------------------------------------
describe("KeywordMatcher – analysis results", () => {
  it("shows 100% score when every JD keyword appears in the resume", async () => {
    const user = userEvent.setup();
    // Resume contains all the meaningful words that will be in the JD
    renderMatcher("javascript typescript react developer engineer");

    await user.type(
      screen.getByRole("textbox"),
      "javascript typescript react developer engineer",
    );
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  it("shows 0% score when no JD keywords appear in the resume", async () => {
    const user = userEvent.setup();
    renderMatcher("unrelated words here nothing matching");

    await user.type(
      screen.getByRole("textbox"),
      "kubernetes devops terraform ansible",
    );
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  it("displays found and total keyword counts", async () => {
    const user = userEvent.setup();
    renderMatcher("javascript react"); // only 2 of 3 keywords present

    await user.type(screen.getByRole("textbox"), "javascript react typescript");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      // Should show "2/3 keywords found" (or similar)
      expect(screen.getByText(/2\/3/)).toBeInTheDocument();
    });
  });

  it('applies the "found" class to matched keyword chips', async () => {
    const user = userEvent.setup();
    const { container } = renderMatcher("typescript developer");

    await user.type(screen.getByRole("textbox"), "typescript developer react");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const foundChips = container.querySelectorAll(".keyword-chip.found");
      expect(foundChips.length).toBeGreaterThan(0);
    });
  });

  it('applies the "missing" class to unmatched keyword chips', async () => {
    const user = userEvent.setup();
    const { container } = renderMatcher("javascript"); // react is missing from resume

    await user.type(screen.getByRole("textbox"), "javascript react typescript");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const missingChips = container.querySelectorAll(".keyword-chip.missing");
      expect(missingChips.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Keyword filtering
// ---------------------------------------------------------------------------
describe("KeywordMatcher – keyword filtering", () => {
  it("excludes common stop words from the keyword list", async () => {
    const user = userEvent.setup();
    renderMatcher("some resume text");

    // "the", "and", "for" are stop words; "developer" is not
    await user.type(screen.getByRole("textbox"), "the developer and for the");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const chips = screen.getAllByText(/developer/i);
      expect(chips.length).toBeGreaterThan(0);
      expect(screen.queryByText(/^the$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^and$/i)).not.toBeInTheDocument();
    });
  });

  it("excludes words shorter than 3 characters", async () => {
    const user = userEvent.setup();
    renderMatcher("developer");

    // "js" and "go" are 2 chars; "developer" is valid
    await user.type(screen.getByRole("textbox"), "js go developer");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.queryByText(/^js$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^go$/i)).not.toBeInTheDocument();
      expect(screen.getByText("developer")).toBeInTheDocument();
    });
  });

  it("strips HTML tags from the resume text before matching", async () => {
    const user = userEvent.setup();
    // Resume has HTML; the word "engineer" should still be extracted
    renderMatcher("<p>software <strong>engineer</strong></p>");

    await user.type(screen.getByRole("textbox"), "software engineer developer");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const foundChips = screen
        .getAllByText(/engineer|software/)
        .filter((el) => el.closest(".keyword-chip.found"));
      expect(foundChips.length).toBeGreaterThan(0);
    });
  });
});
