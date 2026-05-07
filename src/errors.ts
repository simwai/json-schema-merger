import { SUPPORTED_DRAFTS } from './types.js'

const supportedList = [...SUPPORTED_DRAFTS].map((d) => `  • ${d}`).join('\n')

export class DraftMismatchError extends Error {
  constructor(draftA: string | undefined, draftB: string | undefined) {
    super(
      `Cannot merge schemas with different $schema drafts.\n` +
      `  Schema A: ${draftA ?? '(none)'}\n` +
      `  Schema B: ${draftB ?? '(none)'}`
    )
    this.name = 'DraftMismatchError'
  }
}

export class UnsupportedDraftError extends Error {
  constructor(draft: string | undefined) {
    super(
      `Unsupported $schema draft: "${draft ?? '(none)'}"\n` +
      `Supported drafts:\n${supportedList}`
    )
    this.name = 'UnsupportedDraftError'
  }
}

export class UnsupportedKeywordError extends Error {
  constructor(locations: string[]) {
    super(
      `Schema contains unsupported keywords that cannot be safely merged:\n` +
      locations.map((l) => `  • ${l}`).join('\n')
    )
    this.name = 'UnsupportedKeywordError'
  }
}
