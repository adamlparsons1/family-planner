'use client';

import { useEffect, useRef } from 'react';

/**
 * Keep a scrolling list pointed at the next thing to do.
 *
 * On first render, and whenever a tick moves the count forward, the first tile
 * marked `data-next` is brought into view if it is not already fully visible.
 * Unticking never scrolls: that is a child correcting a mistake, and the tile
 * they just tapped should stay under their finger.
 *
 * Scrolls the container itself rather than using scrollIntoView, which would
 * also scroll the page on an iPad and shift the header out of reach.
 */
export function useScrollToNext(completed: number, stickyOffset = 44) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const first = last.current === null;
    const advanced = last.current !== null && completed > last.current;
    last.current = completed;
    if (!container || !(first || advanced)) return;

    const next = container.querySelector<HTMLElement>('[data-next="true"]');
    if (!next) return;

    const box = container.getBoundingClientRect();
    const tile = next.getBoundingClientRect();
    const visible = tile.top >= box.top + stickyOffset && tile.bottom <= box.bottom;
    if (visible) return;

    container.scrollTo({
      top: container.scrollTop + (tile.top - box.top) - stickyOffset - 8,
      behavior: first ? 'auto' : 'smooth',
    });
  }, [completed, stickyOffset]);

  return containerRef;
}
