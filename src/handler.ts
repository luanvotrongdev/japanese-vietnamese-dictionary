import 'dotenv/config'
import path from 'path'
import * as schema from '../schemas'
import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { rawKanjiCrawlJson, rawWordCrawlJson } from '../schemas'
import { cwd, env } from 'process'
import { rm } from 'fs/promises'

type DrizzleDb = BunSQLiteDatabase<typeof schema>

let sqliteInstance: Database | null = null
let cachedDb: DrizzleDb | null = null

export function resolveDatabasePath(): string {
  const dbPath = path.isAbsolute(process.env.DB_PATH || '')
    ? process.env.DB_PATH || ''
    : path.resolve(process.cwd(), process.env.DB_PATH || '')

  if (!dbPath) {
    throw new Error('Database does not exist.')
  }

  return dbPath
}

function ensureSchema(sqlite: Database): void {
  const hasEntryTable = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get('entry')

  if (!hasEntryTable) {
    sqlite.close()
    throw new Error(
      'SQLite schema is missing expected JMdict tables. Run "npx drizzle-kit push" to create them before importing.',
    )
  }
}

export function getDatabase(): DrizzleDb {
  if (cachedDb) {
    return cachedDb
  }

  const sqlite = Database.open(resolveDatabasePath(), { readwrite: true })
  sqlite.run('PRAGMA foreign_keys = ON')
  ensureSchema(sqlite)

  sqliteInstance = sqlite
  cachedDb = drizzle(sqlite, { schema })
  return cachedDb
}

export function closeDatabase(): void {
  cachedDb = null

  if (sqliteInstance) {
    sqliteInstance.close()
    sqliteInstance = null
  }
}


export function resetCrawlTable() {
    const db = getDatabase()
    db.delete(rawWordCrawlJson).run()
    db.delete(rawKanjiCrawlJson).run()
}

export async function resetAll() {
    await rm(resolveDatabasePath())
    await pushSchema(resolveDatabasePath())
}

export async function pushSchema(dbFileName: string | undefined): Promise<void> {
  const drizzleEnv: Record<string, string> = {}
  if (dbFileName) {
    drizzleEnv.DB_PATH = dbFileName
  }
  await runCommand('bunx', ['drizzle-kit', 'push'], drizzleEnv)
}

export async function runCommand(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const proc = Bun.spawn({
    cmd: [command, ...args],
    cwd: cwd(),
    env: {
      ...env,
      ...extraEnv,
    },
    stdio: ['inherit', 'inherit', 'inherit'],
  })

  const status = await proc.exited
  if (status !== 0) {
    throw new Error(`Command "${[command, ...args].join(' ')}" failed with exit code ${status}`)
  }
}