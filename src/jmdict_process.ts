import 'dotenv/config'
import * as schema from '../schemas'
import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import { cwd, exit } from 'process'
import { getDatabase } from 'handler'

type RawNode = unknown

const {
  entry,
  kEle,
  rEle,
} = schema

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function textOf(value: RawNode): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    const withText = value as Record<string, unknown>
    if ('#text' in withText) {
      return textOf(withText['#text'])
    }
    return null
  }
  return null
}

function attrOf(value: RawNode, attribute: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value !== 'object') {
    return undefined
  }
  const record = value as Record<string, unknown>
  const attrValue = record[`@_${attribute}`]
  if (attrValue === null || attrValue === undefined) {
    return undefined
  }
  return String(attrValue)
}

async function getJmdict(): Promise<any> {
  console.log('Parsing JMdict to SQLite raw...')
  const bufferXML = fs.readFileSync(`${cwd()}/${process.env.JMDICT_FILE_NAME}`)
  const parser = new XMLParser({
    htmlEntities: true,
    processEntities: true,
    ignoreAttributes: false,
  })
  let jObj = parser.parse(bufferXML)
  console.log('Done parsing JMdict to SQLite raw!')

  return jObj.JMdict
}


export async function writeJmdictToDatabase(): Promise<void> {
  const jmdict = await getJmdict()
  if (!jmdict?.entry) {
    throw new Error('JMdict payload does not contain any entries')
  }

  const entries = toArray(jmdict.entry as RawNode)
  const db = getDatabase()
  try {
    db.transaction((tx) => {
      tx.delete(entry).run()

      entries.forEach((rawEntry) => {
        const entryRecord = rawEntry as Record<string, unknown>
        const entSeqValue = Number(entryRecord.ent_seq)
        if (Number.isNaN(entSeqValue)) {
          return
        }

        const entryRow = tx
          .insert(entry)
          .values({ entSeq: entSeqValue })
          .returning({ id: entry.id })
          .get()
        if (!entryRow) {
          throw new Error('Failed to insert entry row')
        }
        const entryId = entryRow.id

        const kElements = toArray(entryRecord.k_ele as RawNode)
        kElements.forEach((ke, keIndex) => {
          const node = ke as Record<string, unknown>
          const kebValue = textOf(node.keb)
          if (kebValue === null) {
            return
          }

          const kEleRow = tx
            .insert(kEle)
            .values({
              entryId,
              keb: kebValue,
              position: keIndex,
            })
            .returning({ id: kEle.id })
            .get()
          if (!kEleRow) {
            throw new Error('Failed to insert k_ele row')
          }
          console.log(`Inserted ${kebValue}`)
        })

        const readingElements = toArray(entryRecord.r_ele as RawNode)
        readingElements.forEach((re, reIndex) => {
          const node = re as Record<string, unknown>
          const rebValue = textOf(node.reb)
          if (rebValue === null) {
            return
          }

          const rEleRow = tx
            .insert(rEle)
            .values({
              entryId,
              reb: rebValue,
              position: reIndex,
            })
            .returning({ id: kEle.id })
            .get()
          if (!rEleRow) {
            throw new Error('Failed to insert r_ele row')
          }
          console.log(`Inserted ${rebValue}`)
        })
      })
    })

    console.log('JMdict import complete.')
  } catch(ex) {
    console.error(ex)
    exit(2)
  }
}

if (import.meta.main) {
  await writeJmdictToDatabase()
}
