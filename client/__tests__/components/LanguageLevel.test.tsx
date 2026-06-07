import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import LanguageLevel from "../../src/components/LanguageLevel";

const getDots = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLSpanElement>(".language-level span"),
  );

describe("LanguageLevel", () => {
  it("renders exactly 5 dots", () => {
    const { container } = render(
      <LanguageLevel level={null} onChange={() => {}} />,
    );
    expect(getDots(container)).toHaveLength(5);
  });

  it("marks no dots as active when level is null", () => {
    const { container } = render(
      <LanguageLevel level={null} onChange={() => {}} />,
    );
    getDots(container).forEach((dot) => {
      expect(dot.className).not.toContain("active");
    });
  });

  it("marks dots 1-N as active when level is N", () => {
    const { container } = render(
      <LanguageLevel level={3} onChange={() => {}} />,
    );
    const dots = getDots(container);

    expect(dots[0]).toHaveClass("active");
    expect(dots[1]).toHaveClass("active");
    expect(dots[2]).toHaveClass("active");
    expect(dots[3]).not.toHaveClass("active");
    expect(dots[4]).not.toHaveClass("active");
  });

  it("marks all 5 dots active when level is 5", () => {
    const { container } = render(
      <LanguageLevel level={5} onChange={() => {}} />,
    );
    getDots(container).forEach((dot) => {
      expect(dot).toHaveClass("active");
    });
  });

  it("calls onChange with the clicked dot index when no level is set", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LanguageLevel level={null} onChange={onChange} />,
    );

    fireEvent.click(getDots(container)[2]); // dot 3
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with the dot index when a different dot is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LanguageLevel level={2} onChange={onChange} />,
    );

    fireEvent.click(getDots(container)[4]); // dot 5
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with null when the currently-active level dot is clicked (deselect)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LanguageLevel level={3} onChange={onChange} />,
    );

    fireEvent.click(getDots(container)[2]); // dot 3 == active level → deselect
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange only once per click", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LanguageLevel level={1} onChange={onChange} />,
    );

    fireEvent.click(getDots(container)[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
