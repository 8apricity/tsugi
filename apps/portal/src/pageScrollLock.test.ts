import { describe, expect, it } from "vitest";
import { lockPageScroll } from "./pageScrollLock";

function elementWithClasses() {
  const classes = new Set<string>();
  const style = {
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
  };
  return {
    classes,
    style,
    element: {
      style,
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
    const restored: number[][] = [];

    const unlock = lockPageScroll({
      documentElement: root.element,
      body: body.element,
      defaultView: {
        scrollX: 12,
        scrollY: 240,
        scrollTo: (x: number, y: number) => restored.push([x, y]),
      } as unknown as Document["defaultView"],
    });

    expect(root.classes).toContain("page-scroll-locked");
    expect(body.classes).toContain("page-scroll-locked");
    expect(body.style).toMatchObject({
      position: "fixed",
      top: "-240px",
      left: "-12px",
      right: "0",
      width: "100%",
    });

    unlock();

    expect(root.classes).not.toContain("page-scroll-locked");
    expect(body.classes).not.toContain("page-scroll-locked");
    expect(body.style).toMatchObject({
      position: "",
      top: "",
      left: "",
      right: "",
      width: "",
    });
    expect(restored).toEqual([[12, 240]]);
  });
});
