import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hl, Num } from "./Num";

describe("Num", () => {
  it("renders a bold coloured number with a muted unit", () => {
    render(
      <Num tone="sun" unit="d">
        8.2
      </Num>,
    );
    const n = screen.getByText("8.2");
    expect(n.tagName).toBe("STRONG");
    expect(n).toHaveClass("text-sun", "font-mono", "text-lg");
    expect(screen.getByText("d")).toHaveClass("text-muted");
  });

  it("maps every tone to its palette colour and honours the size prop", () => {
    const { rerender } = render(<Num tone="earth">1</Num>);
    expect(screen.getByText("1")).toHaveClass("text-earth");
    rerender(
      <Num tone="bad" size="xl">
        2
      </Num>,
    );
    expect(screen.getByText("2")).toHaveClass("text-bad", "text-4xl");
    rerender(<Num tone="good">3</Num>);
    expect(screen.getByText("3")).toHaveClass("text-good");
  });

  it("omits the unit when none is given", () => {
    const { container } = render(<Num>5</Num>);
    expect(container.querySelectorAll("span span")).toHaveLength(0);
  });
});

describe("Hl", () => {
  it("wraps a highlighted word in strong text", () => {
    render(<Hl>upper bound</Hl>);
    expect(screen.getByText("upper bound").tagName).toBe("STRONG");
  });
});
