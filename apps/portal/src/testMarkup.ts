export function dialogHeader(markup: string) {
  const header = markup.match(
    /<header class="editor-dialog-header(?: [^"]+)?">(.*?)<\/header>/,
  )?.[1]

  if (header === undefined) {
    throw new Error('Dialog header was not rendered')
  }

  return header
}
