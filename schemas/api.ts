
const MAZII_ENDPOINT = 'https://mazii.net/api/search'
const MAZII_USER_AGENT ='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

export const MAZII_HEADERS = {
      'Content-Type': 'application/json',
      'User-Agent': MAZII_USER_AGENT
    }
export const MAZII_KANJI_ENDPOINT = `${MAZII_ENDPOINT}/kanji`
export const MAZII_WORD_ENDPOINT = `${MAZII_ENDPOINT}/word`

export interface MaziiSearchRequest {
  /**
   * Dictionary to search against. Defaults to `'javi'` which returns Japanese → Vietnamese results.
   */
  dict: string
  /**
   * Search type. For kanji lookups Mazii expects `'kanji'`.
   */
  type?: string
  /**
   * The kanji or reading to search for.
   */
  query: string
  /**
   * The limit to search for.
   */
  limit: number
  /**
   * 1-based page index.
   */
  page?: number
}

export interface MaziiExampleEntry {
  /**
   * Term/phrase associated with the example.
   */
  w: string
  /**
   * Meaning/translation of the term.
   */
  m: string
  /**
   * Pronunciation information.
   */
  p: string
  /**
   * Optional helper reading (present in some payloads).
   */
  h?: string
}

export type MaziiExampleGroups = Record<string, MaziiExampleEntry[]>

export interface MaziiTipsPayload {
  /**
   * Vietnamese tip/description. Mazii may include other languages as additional keys.
   */
  vi?: string
  [key: string]: string | undefined
}

export interface MaziiCompositionNode {
  id: string
  word: string
}

export interface MaziiCompositionLink {
  source: string
  target: string
}

export interface MaziiCompositionGraph {
  nodes: MaziiCompositionNode[]
  links: MaziiCompositionLink[]
}

export interface MaziiCompositionDetail {
  w: string
  h: string
}

export interface MaziiKanjiResult {
  kanji: string
  mean?: string
  detail?: string
  kun?: string
  on?: string
  tips?: MaziiTipsPayload
  level?: string[]
  example_kun?: MaziiExampleGroups
  example_on?: MaziiExampleGroups
  examples?: MaziiExampleEntry[]
  comp_graph?: MaziiCompositionGraph
  compDetail?: MaziiCompositionDetail[]
  image?: string | null
  mobileId?: number
  freq?: number
  writing?: string | null
  stroke_count?: string | number | null
  label?: string
  /**
   * Mazii sometimes sends additional dynamic properties; retain them without sacrificing type safety.
   */
  [key: string]: unknown
}

export interface MaziiKanjiSearchResponse {
  status: number
  results: MaziiKanjiResult[]
  total: number
}

export interface MaziiWordExample {
  content: string
  mean: string
  transcription: string
}

export interface MaziiWordMeaning {
  mean: string
  kind: string | null
  examples: MaziiWordExample[]
}

export interface MaziiSynsetEntry {
  definition_id: string
  synonym: string[]
}

export interface MaziiSynset {
  pos: string
  base_form: string
  entry: MaziiSynsetEntry[]
}

export interface MaziiPronunciationToken {
  type: string
  value: string
}

export interface MaziiPronunciation {
  kana: string
  accent: string
  tokenizedKana: MaziiPronunciationToken[]
}

export interface MaziiWordResult {
  _id: string
  _rev: string
  word: string
  phonetic: string
  weight: number
  short_mean: string
  mobileId: number
  label: string
  lang: string
  means: MaziiWordMeaning[]
  synsets: MaziiSynset[]
  type: string
  opposite_word?: string[]
  pronunciation?: MaziiPronunciation[]
  images?: string[]
  [key: string]: unknown
}

export interface MaziiWordSearchPayload {
  suggestWords: string[]
  words: MaziiWordResult[]
  [key: string]: unknown
}

export interface MaziiWordSearchResponse {
  status: number
  data: MaziiWordSearchPayload
  [key: string]: unknown
}
