import { describe, expect, it } from "vitest";
import { lockPageScroll } from "./pageScrollLock";

function elementWithClasses() {
  const classes = new Set<string>();
  const style = {
    position: "",
    top: "",
    width: "",
    overflow: "",
  };
  return {
    classes,
    style,
    element: {
      classList: {
        add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
        remove: (...tokens: string[]) =>
          tokens.forEach((token) => classes.delete(token)),
      },
      style,
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

  it("captures the page position and restores it when the last dialog closes", () => {
    const root = elementWithClasses();
    const body = elementWithClasses();
    let scrollY = 276;
    const scrollCalls: number[] = [];

    const unlock = lockPageScroll({
      documentElement: root.element,
      body: body.element,
      defaultView: {
        get scrollY() {
          return scrollY;
        },
        scrollTo: ((_x: number, y: number) => {
          scrollY = y;
          scrollCalls.push(y);
        }) as Window["scrollTo"],
      },
    });

    expect(body.style.position).toBe("fixed");
    expect(body.style.top).toBe("-276px");

    scrollY = 0;
    unlock();

    expect(body.style.position).toBe("");
    expect(body.style.top).toBe("");
    expect(scrollCalls).toEqual([276]);
    expect(scrollY).toBe(276);
  });
});
