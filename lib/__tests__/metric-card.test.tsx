import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MetricCard from "@/components/ui/MetricCard";

describe("MetricCard (the one dashboard tile)", () => {
  it("shows label, value and the line under it", () => {
    render(<MetricCard label="Paid orders" value={3} sub="2 buyers" />);
    expect(screen.getByText("Paid orders")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2 buyers")).toBeInTheDocument();
  });

  it("becomes a link when given a destination and colours a delta line", () => {
    render(<MetricCard label="To you" value="$4.75" sub="+12% vs previous" subTone="up" href="/seller/earnings" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/seller/earnings");
    expect(screen.getByText("+12% vs previous").className).toMatch(/emerald/);
  });

  it("colours the value by tone", () => {
    render(<MetricCard label="Late" value={2} tone="amber" />);
    expect(screen.getByText("2").className).toMatch(/amber/);
  });
});
