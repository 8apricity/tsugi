const PAGE_SCROLL_LOCK_CLASS = "page-scroll-locked";

type ScrollLockDocument = Pick<Document, "body" | "documentElement" | "defaultView">;

export function lockPageScroll(document: ScrollLockDocument) {
  const view = document.defaultView;
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;
  const previousStyle = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
  };

  document.documentElement.classList.add(PAGE_SCROLL_LOCK_CLASS);
  document.body.classList.add(PAGE_SCROLL_LOCK_CLASS);
  document.body.style.position = "fixed";
  document.body.style.top = `${-scrollY}px`;
  document.body.style.left = `${-scrollX}px`;
  document.body.style.right = "0";
  document.body.style.width = "100%";

  return () => {
    document.documentElement.classList.remove(PAGE_SCROLL_LOCK_CLASS);
    document.body.classList.remove(PAGE_SCROLL_LOCK_CLASS);
    Object.assign(document.body.style, previousStyle);
    const restoreScroll = () => view?.scrollTo(scrollX, scrollY);
    restoreScroll();
    view?.requestAnimationFrame?.(() => {
      restoreScroll();
      view.requestAnimationFrame(restoreScroll);
    });
  };
}
