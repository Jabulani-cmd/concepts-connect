import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import "@/i18n";

function Broken(): JSX.Element {
  throw new Error("chunk failed");
}

describe("AppErrorBoundary", () => {
  it("shows a reload screen instead of a blank page when a page crashes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("renders the page normally when nothing goes wrong", () => {
    render(<AppErrorBoundary><p>Dashboard</p></AppErrorBoundary>);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
