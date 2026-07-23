import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { TimelineEntry } from "@multica/core/types";
import { renderWithI18n } from "../../test/i18n";
import { JumpToEndButton, ScrollProgressBar } from "./mobile-thread-nav";
import type { MobileThreadNavThread } from "./mobile-thread-nav";

function comment(id: string, content: string): TimelineEntry {
  return {
    type: "comment",
    id,
    actor_type: "member",
    actor_id: "author-" + id,
    created_at: "2026-07-10T10:00:00Z",
    content,
  };
}

function thread(id: string, content: string, itemIndex: number): MobileThreadNavThread {
  return { id, entry: comment(id, content), itemIndex };
}

function scrollContainer(scrollTop = 200, scrollHeight = 2000, clientHeight = 600) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight, configurable: true },
    clientHeight: { value: clientHeight, configurable: true },
    scrollTop: { value: scrollTop, configurable: true, writable: true },
  });
  element.getBoundingClientRect = () =>
    ({ top: 0, bottom: clientHeight, left: 0, right: 400, width: 400, height: clientHeight }) as DOMRect;
  return element;
}

function mountedRow(container: HTMLElement, itemIndex: number, top: number, bottom: number) {
  const row = document.createElement("div");
  row.dataset.timelineIndex = String(itemIndex);
  row.getBoundingClientRect = () =>
    ({ top, bottom, left: 0, right: 400, width: 400, height: bottom - top }) as DOMRect;
  container.appendChild(row);
}

describe("ScrollProgressBar", () => {
  it("renders an aria-hidden bar container", () => {
    const { container } = renderWithI18n(<ScrollProgressBar scrollContainerEl={null} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("clamps iOS overscroll progress to the valid range", () => {
    const beforeStart = scrollContainer(-40);
    const first = renderWithI18n(<ScrollProgressBar scrollContainerEl={beforeStart} />);
    expect(first.container.firstElementChild?.firstElementChild).toHaveStyle({ transform: "scaleX(0)" });

    const beyondEnd = scrollContainer(1800);
    const second = renderWithI18n(<ScrollProgressBar scrollContainerEl={beyondEnd} />);
    expect(second.container.firstElementChild?.firstElementChild).toHaveStyle({ transform: "scaleX(1)" });
  });
});

describe("JumpToEndButton", () => {
  const threads = [
    thread("c1", "First thread", 1),
    thread("c2", "Second thread", 4),
    thread("c3", "Third thread", 7),
    thread("c4", "Fourth thread", 10),
  ];

  it("renders nothing without a scroll container or threads", () => {
    const first = renderWithI18n(
      <JumpToEndButton threads={threads} scrollContainerEl={null} onJumpToEnd={vi.fn()} />,
    );
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();

    const second = renderWithI18n(
      <JumpToEndButton threads={[]} scrollContainerEl={scrollContainer()} onJumpToEnd={vi.fn()} />,
    );
    expect(second.container).toBeEmptyDOMElement();
  });

  it("counts virtualized threads that are not mounted", () => {
    const viewport = scrollContainer(1000, 4000, 600);
    mountedRow(viewport, 3, -200, -100);
    mountedRow(viewport, 4, 100, 300);
    mountedRow(viewport, 5, 700, 900);

    renderWithI18n(
      <JumpToEndButton threads={threads} scrollContainerEl={viewport} onJumpToEnd={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Jump to end" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("jumps to the actual timeline end when clicked", () => {
    const onJumpToEnd = vi.fn();
    renderWithI18n(
      <JumpToEndButton
        threads={threads}
        scrollContainerEl={scrollContainer()}
        onJumpToEnd={onJumpToEnd}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Jump to end" }));
    expect(onJumpToEnd).toHaveBeenCalledTimes(1);
    expect(onJumpToEnd).toHaveBeenCalledWith();
  });

  it("is hidden when scrolled to the bottom", () => {
    const { container } = renderWithI18n(
      <JumpToEndButton
        threads={threads}
        scrollContainerEl={scrollContainer(1350)}
        onJumpToEnd={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("uses a 44px target, explicit motion, focus styling, and safe-area offsets", () => {
    renderWithI18n(
      <JumpToEndButton
        threads={threads}
        scrollContainerEl={scrollContainer()}
        onJumpToEnd={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "Jump to end" });
    expect(button).toHaveClass("size-11", "touch-manipulation", "transition-transform");
    expect(button).toHaveClass(
      "motion-reduce:transform-none",
      "motion-reduce:transition-none",
      "focus-visible:ring-2",
    );
    expect(button).not.toHaveClass("transition-all");
    expect(button.style.bottom).toBe("calc(5rem + env(safe-area-inset-bottom))");
    expect(button.style.right).toBe("calc(1rem + env(safe-area-inset-right))");
  });
});
