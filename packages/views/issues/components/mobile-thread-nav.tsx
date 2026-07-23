import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { useT } from "../../i18n";
import type { ThreadMinimapThread } from "./thread-minimap";

export interface MobileThreadNavThread extends ThreadMinimapThread {
  itemIndex: number;
}

// ---------------------------------------------------------------------------
// MobileThreadNav — touch-friendly navigation for long issue timelines
// ---------------------------------------------------------------------------
//
// Two lightweight affordances that replace the desktop ThreadMinimap on
// small screens (where hover is unavailable and the gutter is too tight):
//
// 1. ScrollProgressBar — a 2px horizontal bar pinned to the top of the
//    scroll area that fills left-to-right as the user scrolls, providing
//    passive "you are here" feedback with zero interaction cost.
//
// 2. JumpToEndButton — a floating circular button that appears when the
//    user scrolls away from the bottom of the timeline. Shows the number of
//    comment threads below the current viewport; tapping jumps to the end
//    of the timeline.
//
// Both components are driven by the same scroll container and thread list
// the desktop minimap uses, so they stay in sync with the timeline.

// ---------------------------------------------------------------------------
// ScrollProgressBar
// ---------------------------------------------------------------------------

/** How far from the bottom counts as "at the bottom" (px). */
const BOTTOM_THRESHOLD_PX = 80;

interface ScrollProgressBarProps {
  scrollContainerEl: HTMLElement | null;
  className?: string;
}

/**
 * Thin reading-progress bar pinned to the top of the scroll viewport.
 * Uses direct style writes inside a passive scroll listener (no React
 * re-render per scroll frame) so it never competes with the timeline's
 * own scroll perf.
 */
export function ScrollProgressBar({ scrollContainerEl, className }: ScrollProgressBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerEl;
    const bar = barRef.current;
    if (!container || !bar) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const max = container.scrollHeight - container.clientHeight;
      const progress =
        max > 0 ? Math.min(Math.max(container.scrollTop / max, 0), 1) : 0;
      bar.style.transform = `scaleX(${progress})`;
      bar.style.opacity = progress > 0.005 && progress < 0.995 ? "1" : "0";
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    container.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    if (container.firstElementChild) ro.observe(container.firstElementChild);
    return () => {
      container.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollContainerEl]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5", className)}
      aria-hidden
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-full bg-primary/70 transition-opacity duration-200 motion-reduce:transition-none"
        style={{ transform: "scaleX(0)", opacity: 0 }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// JumpToEndButton
// ---------------------------------------------------------------------------

interface JumpToEndButtonProps {
  threads: MobileThreadNavThread[];
  scrollContainerEl: HTMLElement | null;
  onJumpToEnd: () => void;
  className?: string;
}

/**
 * Floating "jump to end" button, visible when the user scrolls away
 * from the bottom of the timeline. The badge shows how many comment
 * threads are below the current viewport — the same affordance chat
 * apps use for unread messages, adapted for threaded conversations.
 */
export function JumpToEndButton({
  threads,
  scrollContainerEl,
  onJumpToEnd,
  className,
}: JumpToEndButtonProps) {
  const { t } = useT("issues");
  const [visible, setVisible] = useState(false);
  const [belowCount, setBelowCount] = useState(0);

  useEffect(() => {
    const container = scrollContainerEl;
    if (!container || threads.length === 0) {
      setVisible(false);
      setBelowCount(0);
      return;
    }

    let raf = 0;
    const compute = () => {
      raf = 0;
      const max = Math.max(container.scrollHeight - container.clientHeight, 0);
      const scrollTop = Math.max(container.scrollTop, 0);
      const atBottom = max === 0 || max - scrollTop <= BOTTOM_THRESHOLD_PX;
      setVisible(!atBottom && threads.length > 0);

      if (atBottom) {
        setBelowCount(0);
        return;
      }
      // Virtuoso only mounts a window of rows. Their absolute item indexes
      // let us count every later thread, including rows outside that window.
      const containerRect = container.getBoundingClientRect();
      let lastReachedItemIndex = -1;
      for (const row of container.querySelectorAll<HTMLElement>(
        "[data-timeline-index]",
      )) {
        const itemIndex = Number(row.dataset.timelineIndex);
        if (!Number.isInteger(itemIndex)) continue;
        if (row.getBoundingClientRect().top >= containerRect.bottom) break;
        lastReachedItemIndex = Math.max(lastReachedItemIndex, itemIndex);
      }

      let low = 0;
      let high = threads.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (threads[mid]!.itemIndex <= lastReachedItemIndex) low = mid + 1;
        else high = mid;
      }
      setBelowCount(threads.length - low);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    container.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    if (container.firstElementChild) ro.observe(container.firstElementChild);
    return () => {
      container.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threads, scrollContainerEl]);

  const handleClick = useCallback(() => {
    onJumpToEnd();
  }, [onJumpToEnd]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={t(($) => $.detail.jump_to_end)}
      onClick={handleClick}
      style={{
        bottom: "calc(5rem + env(safe-area-inset-bottom))",
        right: "calc(1rem + env(safe-area-inset-right))",
        WebkitTapHighlightColor: "transparent",
      }}
      className={cn(
        "absolute z-20 flex size-11 touch-manipulation items-center justify-center",
        "rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-foreground/10",
        "transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
        "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95",
        className,
      )}
    >
      <ArrowDown aria-hidden="true" className="h-5 w-5" />
      {belowCount > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center",
            "rounded-full bg-destructive px-1 text-[11px] font-semibold tabular-nums text-destructive-foreground",
          )}
        >
          {belowCount > 99 ? "99+" : belowCount}
        </span>
      )}
    </button>
  );
}