import { createRequire } from 'module'
import { searchMaziiKanji, searchMaziiWord } from 'api'
const require = createRequire(import.meta.url)
type JishoAPICtor = new () => import('unofficial-jisho-api').default
// Fall back to the CommonJS build the ESM bundle expects cheerio to expose a default export.
const JishoAPI = require('unofficial-jisho-api') as unknown as JishoAPICtor

import 'dotenv/config'
import * as schema from '../schemas'
import { eq, sql, gt, gte, desc } from 'drizzle-orm'
import { getDatabase } from 'handler'
import { entry } from '../schemas'

const {
    kEle,
    rEle,
    rawWordCrawlJson,
    rawKanjiCrawlJson
} = schema

const jisho = new JishoAPI()
const minMs: number = Number.parseInt(process.env.MIN_CRAWL_SLEEP!)
const maxMs: number = Number.parseInt(process.env.MAX_CRAWL_SLEEP!)
const minRetryMs: number = Number.parseInt(process.env.MIN_RETRY_SLEEP!)
const maxRetryMs: number = Number.parseInt(process.env.MAX_RETRY_SLEEP!)

let currentPhrase: string = ""
let currentKanji: string = ""
let totalEntry: number = 0
let currentEntry: number = 0
let totalSubEntry: number = 0
let currentSubEntry: number = 0

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function randomSleep() {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    console.log(`           ${ms} SLEEP`)
    await sleep(ms)
}

async function randomSleepBeforeRetry() {
    const ms = Math.floor(Math.random() * (maxRetryMs - minRetryMs + 1)) + minRetryMs
    console.log(`           ${ms} SLEEP BEFORE RETRY`)
    await sleep(ms)
}

const BAR_WIDTH = 30
function printProgress(prefix: string, ratio: number) {
    const filled = Math.round(BAR_WIDTH * ratio)
    const empty = BAR_WIDTH - filled
    const percent = Math.floor(ratio * 100)
    const bar = '='.repeat(filled) + '-'.repeat(empty)
    process.stdout.write(`\r${prefix} [${bar}] ${percent}%\n`)
}

function printOverallProcess() {
    process.stdout.write('\x1b[2J\x1b[H')
    console.log("")
    console.log(` QUERYING  ${currentKanji} in ${currentPhrase}`)
    printProgress(`    ENTRY `, currentEntry / totalEntry)
    printProgress(`   PHRASE `, currentSubEntry / totalSubEntry)
    console.log(`           ${currentSubEntry}/${totalSubEntry} phrases in ${currentEntry}/${totalEntry} entries`)
}

function isKanji(char: string): boolean {
    if (!char) return false
    const code = char.charCodeAt(0)
    return (
        (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
        (code >= 0x20000 && code <= 0x2a6df) || // Extension B
        (code >= 0x2a700 && code <= 0x2b73f) || // Extension C
        (code >= 0x2b740 && code <= 0x2b81f) || // Extension D
        (code >= 0x2b820 && code <= 0x2ceaf) || // Extension E
        (code >= 0x2ceb0 && code <= 0x2ebef)    // Extension F
    )
}

async function crawlKanji(kanji: string) {
    await randomSleep()
    const jishoResult = await jisho.searchForKanji(kanji)
    const maziiKanji = await searchMaziiKanji(kanji)

    printOverallProcess()
    return {
        type: "kanji",
        mazii: maziiKanji,
        jisho: jishoResult
    }
}

async function crawlPhrase(word: string) {
    await randomSleep()
    const jishoResult = await jisho.searchForPhrase(word)
    const maziiWord = await searchMaziiWord(word)

    printOverallProcess()
    return {
        type: "phrase",
        mazii: maziiWord,
        jisho: jishoResult
    }
}

async function crawl(entryId: number, phrase: string) {
    currentPhrase = phrase
    const db = getDatabase()
    const existingPhrase = db
        .select({ entryId: rawWordCrawlJson.entryId })
        .from(rawWordCrawlJson)
        .where(eq(rawWordCrawlJson.entryId, entryId))
        .limit(1)
        .get()
    if (!existingPhrase) {
        const wordResult = await crawlPhrase(phrase)
        db.insert(rawWordCrawlJson)
            .values({
                entryId: entryId,
                json: JSON.stringify(wordResult)
            })
            .run()
    }

    const word: string[] = phrase.split('')
        .filter(element => isKanji(element))
    for (var i = 0; i < word.length; i++) {
        currentKanji = word[i]!
        const existing = db
            .select({ id: rawKanjiCrawlJson.id })
            .from(rawKanjiCrawlJson)
            .where(eq(rawKanjiCrawlJson.textId, currentKanji))
            .limit(1)
            .get()
        if (existing) continue
        const kanjiResult = await crawlKanji(currentKanji)
        db.insert(rawKanjiCrawlJson)
            .values({
                textId: currentKanji,
                json: JSON.stringify(kanjiResult)
            })
            .run()
    }
}

async function getLatestEntryId(): Promise<number> {
    const db = getDatabase()
    const maxEntryId = db.select()
        .from(rawWordCrawlJson)
        .orderBy(desc(rawWordCrawlJson.entryId))
        .limit(1)
        .values()
    return maxEntryId.length > 0 ?
        maxEntryId[0]![1] - 1 //decrease 1 because we want to rerun
        : 0;
}

async function crawlFromDatabase() {
    process.stdout.write('\x1b[2J\x1b[H')
    const db = getDatabase()
    let chunkLimit = 50
    totalEntry = db
        .select({ value: sql<number>`count(*)` })
        .from(entry)
        .get()?.value!;

    while (currentEntry != totalEntry) {
        currentEntry = await getLatestEntryId()
        const kEntries: any = db
            .select({ text: kEle.keb, entryId: kEle.entryId })
            .from(kEle)
            .orderBy(kEle.entryId)
            .where(gt(kEle.entryId, currentEntry))
            .limit(chunkLimit)
            .all()
            .values()
            .toArray()
        const rEntries: any = db
            .select({ text: rEle.reb, entryId: rEle.entryId })
            .from(rEle)
            .orderBy(rEle.entryId)
            .where(gt(rEle.entryId, currentEntry))
            .limit(chunkLimit)
            .all()
            .values()
            .toArray()
        const entries = [
            ...kEntries,
            ...rEntries
        ]
        totalSubEntry = entries.length
        if (totalSubEntry === 0) continue
        for (currentSubEntry = 0; currentSubEntry < totalSubEntry; currentSubEntry++) {
            let row = entries[currentSubEntry]!
            await crawl(row.entryId, row.text)
        }
    }

    console.log("CRAWL DONE!")
}

export async function crawlWithRetryAsync() {
    while (true) {
        try {
            await crawlFromDatabase()
        }
        catch (ex) {
            await randomSleepBeforeRetry()
        }
    }
}