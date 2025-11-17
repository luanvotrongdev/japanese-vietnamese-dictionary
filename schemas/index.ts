import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core"


export const entry = sqliteTable("entry", {
	id: integer().primaryKey().notNull(),
	entSeq: integer("ent_seq").notNull(),
},
(table) => [
	uniqueIndex("entry_ent_seq_unique").on(table.entSeq),
]);

export const kEle = sqliteTable("k_ele", {
	id: integer().primaryKey().notNull(),
	entryId: integer("entry_id").notNull().references(() => entry.id, { onDelete: "cascade" } ),
	keb: text().notNull(),
	position: integer().notNull(),
});

export const rEle = sqliteTable("r_ele", {
	id: integer().primaryKey().notNull(),
	entryId: integer("entry_id").notNull().references(() => entry.id, { onDelete: "cascade" } ),
	reb: text().notNull(),
	reNokanji: text("re_nokanji"),
	position: integer().notNull(),
});

export const rawWordCrawlJson = sqliteTable("raw_word_crawl_json", {
	id: integer().primaryKey().notNull(),
	entryId: integer("entry_id").notNull().references(() => entry.id, { onDelete: "cascade" } ),
	json: text().notNull(),
});

export const rawKanjiCrawlJson = sqliteTable("raw_kanji_crawl_json", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	textId: text(),
	json: text().notNull(),
},
(table) => [
	uniqueIndex("raw_kanji_crawl_json_textId_unique").on(table.textId),
]);

