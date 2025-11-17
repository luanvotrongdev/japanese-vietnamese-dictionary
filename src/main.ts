import 'dotenv/config'
import { exit } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { writeJmdictToDatabase } from './jmdict_process'
import { crawlWithRetryAsync } from 'crawl'
import { buildYomitan } from 'yomitan'
import { 
  closeDatabase, 
  runCommand, 
  resetAll, 
  resetCrawlTable, 
  resolveDatabasePath } from 'handler'
import { buildDictfile } from 'dictfile'

type YesNoDefault = true | false

async function promptYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: YesNoDefault,
): Promise<boolean> {
  const suffix = defaultValue ? ' (Y/n) ' : ' (y/N) '
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase()
  if (answer.length === 0) {
    return defaultValue
  }
  return answer === 'y' || answer === 'yes'
}

async function ensureDownloader(): Promise<void> {
  await runCommand(process.argv[0]!, ['run', 'src/downloader.ts'])
}

async function jmdict() {
  const rl = createInterface({ input, output })

  try {
    const shouldDownload = await promptYesNo(
      rl,
      'Redownload JMdict source archive and extract XML?',
      false,
    )

    if (shouldDownload) {
      console.log('\nDownloading JMdict data...')
      await ensureDownloader()
      console.log('Download complete.\n')
    }

    const shouldPush = await promptYesNo(
      rl,
      'Sync database schema with drizzle-kit?',
      true,
    )

    if (shouldPush) {
      console.log('\nPushing schema with drizzle-kit...')
      await resetAll()
      console.log('Schema sync complete.\n')
    }

    const shouldRegenerate = await promptYesNo(
      rl,
      `Regenerate JMdict data in ${resolveDatabasePath() ?? 'configured database'}?`,
      true,
    )

    if (shouldRegenerate) {
      console.log('\nImporting JMdict entries into database...')
      await writeJmdictToDatabase()
      console.log('Database regeneration complete.\n')
    }

    if (!shouldDownload && !shouldPush && !shouldRegenerate) {
      console.log('No actions were selected. Nothing to do.')
    } else {
      console.log('All requested tasks finished successfully.')
    }
  } catch (error) {
    console.error('Flow failed:', error instanceof Error ? error.message : error)
    exit(3)
  } finally {
    rl.close()
  }
}

const actions: Record<string, () => Promise<void>> = {
  jmdict: async () => { await jmdict() },
  resetall: async () => { await resetAll() },
  resetcrawl: async () => { resetCrawlTable() },
  crawl: async () => { await crawlWithRetryAsync() },
  yomitan: async () => { await buildYomitan() },
  parse: async () => { await writeJmdictToDatabase() },
  dictfile: async()=> { await buildDictfile() }
}

const command = process.argv[2]
const action = command ? actions[command] : undefined

if (!action) {
  console.error('Usage: npm run main -- <jmdict|resetall|resetcrawl|crawl|yomitan>')
  console.error('       jmdict        - fetch and parse jmdict')
  console.error('       resetall      - delete and reset all table')
  console.error('       resetcrawl    - reset jisho/mazii crawl table')
  console.error('       crawl         - start jisho/mazii crawl')
  console.error('       yomitan       - start yomitan export')
  console.error('       dictfile      - start dictfile export')
  process.exit(1)
}

await action()
closeDatabase()
