export function isNoteBodyOverflowing({
  scrollHeight,
  clientHeight,
}: {
  scrollHeight: number
  clientHeight: number
}) {
  return scrollHeight > clientHeight
}
