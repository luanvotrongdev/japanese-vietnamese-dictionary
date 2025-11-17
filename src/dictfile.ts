import 'dotenv/config'
import { createWriteStream, WriteStream } from "node:fs";
import * as schema from '../schemas'
import { gt, sql } from 'drizzle-orm';
import { getDatabase } from 'handler';
import type { JishoAPIResult, JishoWordSense, KanjiParseResult } from 'unofficial-jisho-api';
import type { MaziiKanjiResult, MaziiWordSearchPayload } from '../schemas/api';
import { existsSync, mkdirSync } from 'node:fs';

const {
    rawKanjiCrawlJson,
    rawWordCrawlJson
} = schema

function insertMaziiPhrase(ws: WriteStream, maziiPhrase: MaziiWordSearchPayload) {
    if (!maziiPhrase.words) return
    if (maziiPhrase.words.length == 0) return
    const word = maziiPhrase.words[0]
    if (!word) return
    ws.write(`@${maziiPhrase.words[0]!.word}\n`)
    maziiPhrase.words[0]!
        .means
        .forEach((mean: any) => {
            ws.write(`- ${mean.mean!}\n`)
        });
}

function insertJishoPhrase(ws: WriteStream, jishoPhrase: JishoAPIResult) {
    if (jishoPhrase.meta.status != 200) return
    if (!jishoPhrase.data) return
    if (jishoPhrase.data.length == 0) return
    const word = jishoPhrase.data[0]
    ws.write(`@${word?.slug!}\n`)
    if (word?.japanese.length! > 0) {
        const reading = word?.japanese[0]?.reading
        ws.write(`- ${reading ? reading : ""}\n`)
    }
    word?.senses
        .forEach((mean: JishoWordSense) => {
            mean.english_definitions.map(d => ws.write(`- ${d ? d : ""}\n`))
        });
}

function insertPhrase(
    ws: WriteStream,
    entryRow: typeof rawWordCrawlJson.$inferSelect,
) {
    const jsonParsed = JSON.parse(entryRow.json)
    const jishoPhrase: JishoAPIResult = jsonParsed["jisho"]
    const maziiPhrase: MaziiWordSearchPayload = jsonParsed["mazii"]

    insertMaziiPhrase(ws, maziiPhrase)
    insertJishoPhrase(ws, jishoPhrase)
}

function insertMaziiKanji(ws: WriteStream, maziiKanjis: MaziiKanjiResult[]) {
    if (!maziiKanjis) return
    if (maziiKanjis.length == 0) return
    const maziiKanji = maziiKanjis[0]
    ws.write(`@${maziiKanji?.kanji!}\n`)
    ws.write(`- Hán: ${maziiKanji?.mean}\n`)
    ws.write(`- [${maziiKanji?.kun ? maziiKanji?.kun! : ""}]\n`)
    ws.write(`- (${maziiKanji?.on ? maziiKanji?.on! : ""})\n`)
}

function insertJishoKanji(ws: WriteStream, jishoKanji: KanjiParseResult) {
    if (!jishoKanji) return
    if (!jishoKanji.found) return
    ws.write(`@${jishoKanji.query}\n`)
    ws.write(`- [${jishoKanji.kunyomi.join(", ")}]\n`)
    ws.write(`- (${jishoKanji.onyomi.join(", ")})\n`)
}

function insertKanji(
    ws: WriteStream,
    entryRow: typeof rawKanjiCrawlJson.$inferSelect
) {
    const jsonParsed = JSON.parse(entryRow.json)
    const jishoPhrase: KanjiParseResult = jsonParsed["jisho"]
    const maziiPhrase: MaziiKanjiResult[] = jsonParsed["mazii"]

    insertMaziiKanji(ws, maziiPhrase)
    insertJishoKanji(ws, jishoPhrase)
}

async function queryPaginatedEntries(ws: WriteStream, chunkLimit: number) {
    var entryInsertedTotal = 0;
    const db = getDatabase()
    const phraseTotal = db
        .select({ value: sql<number>`count(*)` })
        .from(rawWordCrawlJson)
        .get()?.value!;
    const kanjiTotal = db
        .select({ value: sql<number>`count(*)` })
        .from(rawKanjiCrawlJson)
        .get()?.value!;
    const entryTotal = phraseTotal + kanjiTotal

    // INPUT TERM
    let lastEntryId: number | null = -1;
    while (true) {
        const entries = db
            .select()
            .from(rawWordCrawlJson)
            .orderBy(rawWordCrawlJson.id)
            .where(gt(rawWordCrawlJson.id, lastEntryId))
            .limit(chunkLimit)
            .all()

        if (entries.length === 0) break
        lastEntryId = entries[entries.length - 1]!.id
        for (const row of entries) {
            insertPhrase(ws, row);
            entryInsertedTotal += 1
            console.log(`${entryInsertedTotal}/${entryTotal}`,)
        }
    }

    //INPUT KANJI
    lastEntryId = -1;
    while (true) {
        const entries = db
            .select()
            .from(rawKanjiCrawlJson)
            .orderBy(rawKanjiCrawlJson.id)
            .where(gt(rawKanjiCrawlJson.id, lastEntryId))
            .limit(chunkLimit)
            .all()

        if (entries.length === 0) break
        lastEntryId = entries[entries.length - 1]!.id
        for (const row of entries) {
            insertKanji(ws, row);
            entryInsertedTotal += 1
            console.log(`${entryInsertedTotal}/${entryTotal}`,)
        }
    }
}

export async function buildDictfile() {
    const outputDir = "./output"
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
    }
    const writeStream = createWriteStream(`${outputDir}/lulujv.df`, { flags: "a" })
    await queryPaginatedEntries(writeStream, 2000)
}