export class UnsupportedKeywordError extends Error {
  constructor(paths: string[]) {
    super(
      `The following keywords require evaluation-state or reference resolution ` +
      `and cannot be safely merged by this POC:\n  ${paths.join('\n  ')}\n` +
      `Remove them or handle them manually before merging.`
    )
    this.name = 'UnsupportedKeywordError'
  }
}

export class DraftMismatchError extends Error {
  constructor(a: string | undefined, b: string | undefined) {
    super(
      `Both schemas must declare the same $schema. ` +
      `Got "${a ?? '(none)'}" and "${b ?? '(none)'}".`
    )
    this.name = 'DraftMismatchError'
  }
}

export class UnsupportedDraftError extends Error {
  constructor(draft: string | undefined) {
    super(
      `Unsupported draft "${draft ?? '(none)'}". ` +
      `Only "${SUPPORTED_DRAFT}" is supported.`
    )
    this.name = 'UnsupportedDraftError'
  }
}

import { SUPPORTED_DRAFT } from './types.js'
