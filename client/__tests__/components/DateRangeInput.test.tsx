import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import DateRangeInput from "../../src/components/DateRangeInput";

const getInputs = (container: HTMLElement) => ({
  start: container.querySelector<HTMLInputElement>(".date-range-input-start")!,
  end: container.querySelector<HTMLInputElement>(".date-range-input-end")!,
});

describe("DateRangeInput", () => {
  it("renders two month inputs", () => {
    const { container } = render(
      <DateRangeInput start="" end="" onChange={() => {}} />,
    );
    const { start, end } = getInputs(container);
    expect(start).toBeInTheDocument();
    expect(end).toBeInTheDocument();
    expect(start.type).toBe("month");
    expect(end.type).toBe("month");
  });

  it("reflects the provided start and end values", () => {
    const { container } = render(
      <DateRangeInput start="2023-01" end="2024-06" onChange={() => {}} />,
    );
    const { start, end } = getInputs(container);
    expect(start.value).toBe("2023-01");
    expect(end.value).toBe("2024-06");
  });

  it("calls onChange with updated start and preserved end when start changes", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateRangeInput start="2023-01" end="2024-06" onChange={onChange} />,
    );
    fireEvent.change(getInputs(container).start, {
      target: { value: "2022-03" },
    });
    expect(onChange).toHaveBeenCalledWith({ start: "2022-03", end: "2024-06" });
  });

  it("calls onChange with preserved start and updated end when end changes", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateRangeInput start="2023-01" end="2024-06" onChange={onChange} />,
    );
    fireEvent.change(getInputs(container).end, {
      target: { value: "2025-12" },
    });
    expect(onChange).toHaveBeenCalledWith({ start: "2023-01", end: "2025-12" });
  });

  it("applies the given className to the wrapper", () => {
    const { container } = render(
      <DateRangeInput
        start=""
        end=""
        onChange={() => {}}
        className="my-date"
      />,
    );
    expect(container.firstChild).toHaveClass("my-date");
  });

  it("renders the separator between the two inputs", () => {
    const { container } = render(
      <DateRangeInput start="" end="" onChange={() => {}} />,
    );
    expect(
      container.querySelector(".date-range-separator"),
    ).toBeInTheDocument();
  });

  it("uses empty strings as default values for start and end", () => {
    const { container } = render(<DateRangeInput onChange={() => {}} />);
    const { start, end } = getInputs(container);
    expect(start.value).toBe("");
    expect(end.value).toBe("");
  });
});
