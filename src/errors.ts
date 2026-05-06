export class UnsupportedKeywordError extends Error {
  constructor(keyword: string) {
    super(
      `Keyword "${keyword}" requires evaluation-state or reference resolution and is not supported by this POC merger. ` +
      `Remove it or handle it manually before merging.`
    )
    this.name = 'UnsupportedKeywordError'
  }
}

export class DraftMismatchError extends Error {
  constructor(a: string | undefined, b: string | undefined) {
    super(
      `Both schemas must declare the same $schema draft. ` +
      `Got "${a ?? '(none)'}" and "${b ?? '(none)'}".`
    )
    this.name = 'DraftMismatchError'
  }
}

export class UnsupportedDraftError extends Error {
  constructor(draft: string | undefined) {
    super(
      `Unsupported draft "${draft ?? '(none)'}". ` +
      `Only "https://json-schema.org/draft/2020-12/schema" is supported.`
    )
    this.name = 'UnsupportedDraftError'
  }
}
