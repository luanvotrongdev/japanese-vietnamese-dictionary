# **This repository exists purely as a personal scratchpad—use it at your own risk.**

# ja-vi-jmdict

> **Personal scratchpad** – I hacked this together in my free time, only for myself, and I do not plan to maintain or support it.

A tiny pipeline that merges a few public Japanese dictionary sources into a Japanese→Vietnamese dataset. The scripts exist mainly so I can export a package that imports cleanly into the [Yomitan browser extension](https://yomitan.wiki).
The script also support exporting to ditcfile format that allow user to merge with another dictfile and then export to KOBO dicthtml using [dictutil](https://github.com/pgaskin/dictutil).

## Data sources

This repository does **not** ship any dictionary data. You must download and place the raw files yourself before running anything. The tooling expects exports that were crawled from:

- [JMdict](https://www.edrdg.org/jmdict/edict.html)
- [Mazii.net](https://mazii.net)
- [Jisho.org](https://jisho.org)

Use the existing `sources/`, `dbs/`, and `output/` folders as a hint for where the files should live.

## Requirements

- [Bun](https://bun.sh) `>=1.2.10`
- A configured `.env` file pointing to your database/output locations
- Locally downloaded JMdict / Mazii / Jisho datasets arranged in the expected paths

## Usage

1. Install dependencies:
   ```bash
   bun install
   ```
2. Drop your crawled datasets into the paths referenced by the scripts (none of that data is committed here).
3. Run whichever workflow you need:
   - `bun run main jmdict` – interactively download and import JMdict entries into the database.
   - `bun run main crawl` – crawl Mazii.net and Jisho.org for additional entries/definitions.
   - `bun run main yomitan` – export the merged dictionary into the Yomitan pack described below.

## Exporting to Yomitan

Running `bun run main yomitan` builds `output/lulujv.zip`, which is a Yomitan-compatible dictionary archive. Open the Yomitan extension, go to *Settings → Dictionaries → Import*, and drop that ZIP file to make the entries available in your browser.
