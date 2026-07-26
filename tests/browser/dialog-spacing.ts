import { expect, type Locator } from '@playwright/test'

export async function expectCompactReadOnlyDialogSpacing(
  dialog: Locator,
  firstContent: Locator,
  horizontalContent = firstContent,
) {
  const body = dialog.locator('.editor-dialog-body')
  const [bodySpacing, firstContentMargin, horizontalContentMargin] =
    await Promise.all([
      body.evaluate((element) => {
        const style = element.ownerDocument.defaultView!.getComputedStyle(
          element,
        )
        return {
          top: style.paddingTop,
          right: style.paddingRight,
          bottom: style.paddingBottom,
          left: style.paddingLeft,
        }
      }),
      firstContent.evaluate((element) =>
        element.ownerDocument.defaultView!.getComputedStyle(element).marginTop),
      horizontalContent.evaluate((element) => {
        const style = element.ownerDocument.defaultView!.getComputedStyle(
          element,
        )
        return {
          right: style.marginRight,
          left: style.marginLeft,
        }
      }),
  ])

  expect(bodySpacing).toEqual({
    top: '12px',
    right: '16px',
    bottom: '16px',
    left: '16px',
  })
  expect(firstContentMargin).toBe('0px')
  expect(horizontalContentMargin).toEqual({
    right: '0px',
    left: '0px',
  })
}
