const PAGE_SCROLL_LOCK_CLASS = "page-scroll-locked";

type ScrollLockDocument = Pick<Document, "body" | "documentElement">;

export function lockPageScroll(document: ScrollLockDocument) {
  document.documentElement.classList.add(PAGE_SCROLL_LOCK_CLASS);
  document.body.classList.add(PAGE_SCROLL_LOCK_CLASS);

  return () => {
    document.documentElement.classList.remove(PAGE_SCROLL_LOCK_CLASS);
    document.body.classList.remove(PAGE_SCROLL_LOCK_CLASS);
  };
}
