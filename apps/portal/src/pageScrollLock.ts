const PAGE_SCROLL_LOCK_CLASS = "page-scroll-locked";

type ScrollLockWindow = Pick<Window, "scrollY" | "scrollTo">;

type ScrollLockDocument = Pick<Document, "body" | "documentElement"> & {
  defaultView?: ScrollLockWindow | null;
};

export function lockPageScroll(document: ScrollLockDocument) {
  const scrollY = document.defaultView?.scrollY ?? Math.max(
    document.documentElement.scrollTop,
    document.body.scrollTop,
    0,
  );
  const previousBodyStyle = {
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
  };

  document.documentElement.classList.add(PAGE_SCROLL_LOCK_CLASS);
  document.body.classList.add(PAGE_SCROLL_LOCK_CLASS);
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";

  return () => {
    document.documentElement.classList.remove(PAGE_SCROLL_LOCK_CLASS);
    document.body.classList.remove(PAGE_SCROLL_LOCK_CLASS);
    document.body.style.position = previousBodyStyle.position;
    document.body.style.top = previousBodyStyle.top;
    document.body.style.width = previousBodyStyle.width;
    document.defaultView?.scrollTo(0, scrollY);
  };
}
