export const BOOKS = [
  { slug: "gen", name: "Genesis", aliases: [] },
  { slug: "exod", name: "Exodus", aliases: [] },
  { slug: "lev", name: "Leviticus", aliases: [] },
  { slug: "num", name: "Numbers", aliases: [] },
  { slug: "deut", name: "Deuteronomy", aliases: [] },
  { slug: "josh", name: "Joshua", aliases: [] },
  { slug: "judg", name: "Judges", aliases: [] },
  { slug: "ruth", name: "Ruth", aliases: [] },
  { slug: "1sam", name: "1 Samuel", aliases: ["I Samuel"] },
  { slug: "2sam", name: "2 Samuel", aliases: ["II Samuel"] },
  { slug: "1kgs", name: "1 Kings", aliases: ["I Kings"] },
  { slug: "2kgs", name: "2 Kings", aliases: ["II Kings"] },
  { slug: "1chr", name: "1 Chronicles", aliases: ["I Chronicles"] },
  { slug: "2chr", name: "2 Chronicles", aliases: ["II Chronicles"] },
  { slug: "ezra", name: "Ezra", aliases: [] },
  { slug: "neh", name: "Nehemiah", aliases: [] },
  { slug: "esth", name: "Esther", aliases: [] },
  { slug: "job", name: "Job", aliases: [] },
  { slug: "ps", name: "Psalms", aliases: [] },
  { slug: "prov", name: "Proverbs", aliases: [] },
  { slug: "eccl", name: "Ecclesiastes", aliases: [] },
  { slug: "song", name: "Song of Solomon", aliases: [] },
  { slug: "isa", name: "Isaiah", aliases: [] },
  { slug: "jer", name: "Jeremiah", aliases: [] },
  { slug: "lam", name: "Lamentations", aliases: [] },
  { slug: "ezek", name: "Ezekiel", aliases: [] },
  { slug: "dan", name: "Daniel", aliases: [] },
  { slug: "hos", name: "Hosea", aliases: [] },
  { slug: "joel", name: "Joel", aliases: [] },
  { slug: "amos", name: "Amos", aliases: [] },
  { slug: "obad", name: "Obadiah", aliases: [] },
  { slug: "jonah", name: "Jonah", aliases: [] },
  { slug: "mic", name: "Micah", aliases: [] },
  { slug: "nah", name: "Nahum", aliases: [] },
  { slug: "hab", name: "Habakkuk", aliases: [] },
  { slug: "zeph", name: "Zephaniah", aliases: [] },
  { slug: "hag", name: "Haggai", aliases: [] },
  { slug: "zech", name: "Zechariah", aliases: [] },
  { slug: "mal", name: "Malachi", aliases: [] },
  { slug: "matt", name: "Matthew", aliases: [] },
  { slug: "mark", name: "Mark", aliases: [] },
  { slug: "luke", name: "Luke", aliases: [] },
  { slug: "john", name: "John", aliases: [] },
  { slug: "acts", name: "Acts", aliases: [] },
  { slug: "rom", name: "Romans", aliases: [] },
  { slug: "1cor", name: "1 Corinthians", aliases: ["I Corinthians"] },
  { slug: "2cor", name: "2 Corinthians", aliases: ["II Corinthians"] },
  { slug: "gal", name: "Galatians", aliases: [] },
  { slug: "eph", name: "Ephesians", aliases: [] },
  { slug: "phil", name: "Philippians", aliases: [] },
  { slug: "col", name: "Colossians", aliases: [] },
  { slug: "1thess", name: "1 Thessalonians", aliases: ["I Thessalonians"] },
  { slug: "2thess", name: "2 Thessalonians", aliases: ["II Thessalonians"] },
  { slug: "1tim", name: "1 Timothy", aliases: ["I Timothy"] },
  { slug: "2tim", name: "2 Timothy", aliases: ["II Timothy"] },
  { slug: "titus", name: "Titus", aliases: [] },
  { slug: "phlm", name: "Philemon", aliases: [] },
  { slug: "heb", name: "Hebrews", aliases: [] },
  { slug: "jas", name: "James", aliases: [] },
  { slug: "1pet", name: "1 Peter", aliases: ["I Peter"] },
  { slug: "2pet", name: "2 Peter", aliases: ["II Peter"] },
  { slug: "1john", name: "1 John", aliases: ["I John"] },
  { slug: "2john", name: "2 John", aliases: ["II John"] },
  { slug: "3john", name: "3 John", aliases: ["III John"] },
  { slug: "jude", name: "Jude", aliases: [] },
  { slug: "rev", name: "Revelation", aliases: ["Revelation of John"] },
] as const;

export type BookSlug = (typeof BOOKS)[number]["slug"];

const nameToSlug = new Map<string, BookSlug>(
  BOOKS.flatMap((book) => [
    [book.name, book.slug],
    ...book.aliases.map((alias) => [alias, book.slug] as const),
  ]),
);

export function bookNameToSlug(name: string): BookSlug | undefined {
  return nameToSlug.get(name);
}

export function verseKey(
  book: BookSlug,
  chapter: number,
  verse: number,
): string {
  return `${book}.${chapter}.${verse}`;
}
