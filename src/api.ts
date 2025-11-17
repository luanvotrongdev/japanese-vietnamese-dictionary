import {
  type MaziiKanjiResult,
  type MaziiSearchRequest,
  type MaziiKanjiSearchResponse,
  type MaziiWordSearchResponse,
  type MaziiWordSearchPayload,
  MAZII_KANJI_ENDPOINT,
  MAZII_WORD_ENDPOINT,
  MAZII_HEADERS
} from '../schemas/api.ts'


function assertResponseShape(payload: unknown): asserts payload is MaziiKanjiSearchResponse {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as MaziiKanjiSearchResponse).status !== 'number' ||
    !Array.isArray((payload as MaziiKanjiSearchResponse).results) ||
    typeof (payload as MaziiKanjiSearchResponse).total !== 'number'
  ) {
    throw new Error('Mazii kanji search response is missing expected fields')
  }
}

export async function searchMaziiKanji(kanji: string): Promise<MaziiKanjiResult[]> {
  const response = await fetch(MAZII_KANJI_ENDPOINT, {
    method: 'POST',
    headers: MAZII_HEADERS,
    body: JSON.stringify({
        dict: "javi",
        type: "kanji",
        query: kanji,
        limit: 1,
        page: 1
    } as MaziiSearchRequest),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Mazii kanji search failed with status ${response.status} ${response.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    )
  }

  const json = (await response.json()) as unknown

  assertResponseShape(json)

  return json.results
}

function assertWordResponseShape(payload: unknown): asserts payload is MaziiWordSearchResponse {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as MaziiWordSearchResponse).status !== 'number'
  ) {
    throw new Error('Mazii word search response is missing expected status field')
  }

  const data = (payload as MaziiWordSearchResponse).data
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as MaziiWordSearchPayload).words) ||
    !Array.isArray((data as MaziiWordSearchPayload).suggestWords)
  ) {
    throw new Error('Mazii word search response is missing expected data payload')
  }
}

interface MaziiWordSearchOptions {
  dict?: string
  limit?: number
  page?: number
}

export async function searchMaziiWord(
  query: string,
  { dict = 'javi', limit = 10, page = 1 }: MaziiWordSearchOptions = {},
): Promise<MaziiWordSearchPayload> {
  const response = await fetch(MAZII_WORD_ENDPOINT, {
    method: 'POST',
    headers: MAZII_HEADERS,
    body: JSON.stringify({
      dict,
      type: 'word',
      query,
      limit,
      page,
    } satisfies MaziiSearchRequest),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Mazii word search failed with status ${response.status} ${response.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    )
  }

  const json = (await response.json()) as unknown
  assertWordResponseShape(json)

  return json.data
}
