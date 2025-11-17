import 'dotenv/config'
import { Dictionary, DictionaryIndex, KanjiEntry, TermEntry } from "yomichan-dict-builder";
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

function insertMaziiPhrase(termEntry: TermEntry, maziiPhrase: MaziiWordSearchPayload) {
    if (!maziiPhrase.words) return
    if (maziiPhrase.words.length == 0) return
    const word = maziiPhrase.words[0]
    if (!word) return
    termEntry.setTerm(maziiPhrase.words[0]!.word)
    maziiPhrase.words[0]!
        .means
        .forEach((mean: any) => {
            termEntry.addDetailedDefinition(`${mean.mean!}\n`)
        });
}

function insertJishoPhrase(termEntry: TermEntry, jishoPhrase: JishoAPIResult) {
    if (jishoPhrase.meta.status != 200) return
    if (!jishoPhrase.data) return
    if (jishoPhrase.data.length == 0) return
    const word = jishoPhrase.data[0]
    termEntry.setTerm(word?.slug!)
    if (word?.japanese.length! > 0) {
        const reading = word?.japanese[0]?.reading
        termEntry.setReading(reading ? reading : "");
    }
    word?.senses
        .forEach((mean: JishoWordSense) => {
            termEntry.addDetailedDefinitions(mean.english_definitions.map(d => d))
        });
}

function insertPhrase(
    dictionary: Dictionary,
    entryRow: typeof rawWordCrawlJson.$inferSelect,
) {
    const jsonParsed = JSON.parse(entryRow.json)
    const jishoPhrase: JishoAPIResult = jsonParsed["jisho"]
    const maziiPhrase: MaziiWordSearchPayload = jsonParsed["mazii"]

    const termEntry = new TermEntry("")
    insertMaziiPhrase(termEntry, maziiPhrase)
    insertJishoPhrase(termEntry, jishoPhrase)
    dictionary.addTerm(termEntry.build())
}

function insertMaziiKanji(kanjiEntry: KanjiEntry, maziiKanjis: MaziiKanjiResult[]) {
    if (!maziiKanjis) return
    if (maziiKanjis.length == 0) return
    const maziiKanji = maziiKanjis[0]
    kanjiEntry.setKanji(maziiKanji?.kanji!)
        .addMeaning(`HÁN: ${maziiKanji?.mean}\n`)
        .addMeaning(maziiKanji?.detail! + "\n")
        .setKunyomi(maziiKanji?.kun ? maziiKanji?.kun! : "")
        .setOnyomi(maziiKanji?.on ? maziiKanji?.on! : "")
}

function insertJishoKanji(kanjiEntry: KanjiEntry, jishoKanji: KanjiParseResult) {
    if (!jishoKanji) return
    if (!jishoKanji.found) return
    kanjiEntry.setKanji(jishoKanji.query)
        .setOnyomi(`${kanjiEntry.onyomi}, ${jishoKanji.onyomi.join(", ")}`)
        .setKunyomi(`${kanjiEntry.kunyomi}, ${jishoKanji.kunyomi.join(", ")}`)
}

function insertKanji(
    dictionary: Dictionary,
    entryRow: typeof rawKanjiCrawlJson.$inferSelect
) {
    const jsonParsed = JSON.parse(entryRow.json)
    const jishoPhrase: KanjiParseResult = jsonParsed["jisho"]
    const maziiPhrase: MaziiKanjiResult[] = jsonParsed["mazii"]

    const kanjiEntry = new KanjiEntry("")
    insertMaziiKanji(kanjiEntry, maziiPhrase)
    insertJishoKanji(kanjiEntry, jishoPhrase)
    if (kanjiEntry.kanji.length == 0) return
    if (kanjiEntry.meanings.length == 0) return
    dictionary.addKanji(kanjiEntry.build())
}

async function queryPaginatedEntries(dictionary: Dictionary, chunkLimit: number) {
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
            insertPhrase(dictionary, row);
            entryInsertedTotal += 1
            console.log(`${entryInsertedTotal}/${entryTotal}`,)
        }
        await dictionary.export()
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
            insertKanji(dictionary, row);
            entryInsertedTotal += 1
            console.log(`${entryInsertedTotal}/${entryTotal}`,)
        }
        await dictionary.export()
    }
}

export async function buildYomitan() {
    const outputDir = "./output"
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
    }
    const dictionary = new Dictionary({
        fileName: `${outputDir}/lulujv.zip`
    })

    const index = new DictionaryIndex()
        .setTitle("Lulu J-V Dictionary")
        .setAuthor("LULU")
        .setRevision("0.2")
        .setDescription("A Japanese -> Vietnamese/English dictionary for Yomitan dict")
        .setAttribution('Japanese,Vietnamese,English')
        .build()
    await dictionary.setIndex(index)
    await queryPaginatedEntries(dictionary, 2000)
}
