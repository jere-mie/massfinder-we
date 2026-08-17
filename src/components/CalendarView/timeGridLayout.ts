const EVENT_BEFORE_MORE_CLASS = 'fc-event-harness-before-more';

function ratioFromStyle(value: string, fallback: number, width: number): number {
  if (value.endsWith('%')) return Number.parseFloat(value) / 100;
  if (value.endsWith('px')) return Number.parseFloat(value) / width;
  return fallback;
}

/**
 * FullCalendar overlays its time-grid +N control on the right edge of the
 * event column. Reserve that space across every visible lane that shares the
 * control's vertical interval so all inline events stay equally proportioned.
 */
export function scheduleTimeGridMoreLinkLayout(parent: Element | null): void {
  if (!(parent instanceof HTMLElement)) return;

  requestAnimationFrame(() => {
    if (!parent.isConnected) return;

    const eventHarnesses = Array.from(
      parent.querySelectorAll<HTMLElement>('.fc-timegrid-event-harness'),
    );
    const moreLinks = Array.from(
      parent.querySelectorAll<HTMLElement>('.fc-timegrid-more-link'),
    );

    eventHarnesses.forEach((eventHarness) => {
      eventHarness.classList.remove(EVENT_BEFORE_MORE_CLASS);
      eventHarness.style.removeProperty('--fc-more-left');
      eventHarness.style.removeProperty('--fc-more-right');
    });

    if (moreLinks.length === 0 || eventHarnesses.length === 0) return;

    const parentRect = parent.getBoundingClientRect();
    if (parentRect.width <= 0) return;

    const eventElements = eventHarnesses.map((harness) => ({
      element: harness.querySelector<HTMLElement>('.fc-timegrid-event'),
      harness,
      rect: harness.getBoundingClientRect(),
    })).filter((item): item is {
      element: HTMLElement;
      harness: HTMLElement;
      rect: DOMRect;
    } => item.element !== null);
    const affectedHarnesses = new Set<HTMLElement>();

    for (const moreLink of moreLinks) {
      const moreRect = moreLink.getBoundingClientRect();
      for (const event of eventElements) {
        if (event.rect.top < moreRect.bottom && event.rect.bottom > moreRect.top) {
          affectedHarnesses.add(event.harness);
        }
      }
    }

    // Include the rest of the connected overlap group. This prevents a
    // resized event from leaving a gap beside a later event that overlaps it.
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const event of eventElements) {
        if (affectedHarnesses.has(event.harness)) continue;
        const overlapsAffectedEvent = eventElements.some(
          (other) =>
            affectedHarnesses.has(other.harness) &&
            event.rect.top < other.rect.bottom &&
            event.rect.bottom > other.rect.top,
        );
        if (overlapsAffectedEvent) {
          affectedHarnesses.add(event.harness);
          expanded = true;
        }
      }
    }

    const moreLinkWidth = Math.max(...moreLinks.map((link) => link.getBoundingClientRect().width));
    const availableWidth = Math.max(parentRect.width - moreLinkWidth, 0);

    for (const event of eventElements) {
      if (!affectedHarnesses.has(event.harness)) continue;

      const inlineLeft = event.harness.style.left;
      const inlineRight = event.harness.style.right;
      const leftRatio = ratioFromStyle(
        inlineLeft,
        (event.rect.left - parentRect.left) / parentRect.width,
        parentRect.width,
      );
      const rightRatio = ratioFromStyle(
        inlineRight,
        (parentRect.right - event.rect.right) / parentRect.width,
        parentRect.width,
      );

      event.harness.style.setProperty('--fc-more-left', `${leftRatio * availableWidth}px`);
      event.harness.style.setProperty(
        '--fc-more-right',
        `${parentRect.width - (1 - rightRatio) * availableWidth}px`,
      );
      event.harness.classList.add(EVENT_BEFORE_MORE_CLASS);
    }
  });
}
