import { describe, expect, it } from "vitest";
import { lockPageScroll } from "./pageScrollLock";

function elementWithClasses() {
  const classes = new Set<string>();
  return {
    classes,
    element: {
      classList: {
        add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
        remove: (...tokens: string[]) =>
          tokens.forEach((token) => classes.delete(token)),
      },
    } as unknown as HTMLElement,
  };
}

describe("lockPageScroll", () => {
  it("locks both page scroll containers until cleanup", () => {
    const root = elementWithClasses();
    const body = elementWithClasses();

    const unlock = lockPageScroll({
      documentElement: root.element,
      body: body.element,
    });

    expect(root.classes).toContain("page-scroll-locked");
    expect(body.classes).toContain("page-scroll-locked");

    unlock();

    expect(root.classes).not.toContain("page-scroll-locked");
    expect(body.classes).not.toContain("page-scroll-locked");
  });
});
