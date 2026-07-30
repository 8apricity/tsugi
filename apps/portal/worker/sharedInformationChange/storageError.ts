export class StorageUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Shared Information storage is unavailable', options)
    this.name = 'StorageUnavailableError'
  }
}

export function rethrowKnownStorageUnavailable(error: unknown): never {
  if (error instanceof StorageUnavailableError) throw error
  const unavailable = storageUnavailableError(error)
  if (unavailable) throw unavailable
  throw error
}

export function storageUnavailableError(error: unknown) {
  if (error instanceof StorageUnavailableError) return error
  if (!(error instanceof Error)) return null
  const d1Message = [error.message, error.cause]
    .map((value) => value instanceof Error ? value.message : value)
    .find((value): value is string =>
      typeof value === 'string' &&
      /^D1_(?:ERROR|EXEC_ERROR|TYPE_ERROR|COLUMN_NOTFOUND):/i.test(value)
    )
  const unavailable = d1Message !== undefined &&
    /\b(unavailable|timed? ?out|timeout|network|locked|busy|reset|transient|overloaded|disconnected|memory limit|CPU time limit)\b/i
      .test(d1Message)
  return unavailable
    ? new StorageUnavailableError({ cause: error })
    : null
}
