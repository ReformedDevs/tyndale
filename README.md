# Tyndale

A Discord bot that responds to bracket Bible citations in messages — like `[Gen 1:1]` — with verse text from public-domain translations.

Supported translations: **WEB** (default), **ASV**, **YLT**, **KJV**, **Geneva**, **Tyndale**, and **WYC** (Wycliffe). The list is driven by [`registry/translations.json`](registry/translations.json) and whatever is synced into `content/bibles/`.

## Prerequisites

- Node.js 20+
- A [Discord application](https://discord.com/developers/applications) with a bot token
- `unzip` on your PATH (for USFM poetry layout during content sync)

## Setup

```bash
git clone <repo-url>
cd tyndale
npm install
npm run sync-content -- --full   # first-time: download all content (alias: npm run build-data)
cp .env.example .env
```

Add your bot token to `.env`:

```env
DISCORD_BOT_TOKEN=your_token_here
DEFAULT_TRANSLATION=web
DEFAULT_TEXT_FORMAT=literary
LOG_LEVEL=info
```

Optional paths:

```env
# Built content (default: ./content)
# CONTENT_DIR=/var/tyndale/content

# Guild/user preferences (default: ~/.tyndale)
# STATE_DIR=/var/tyndale
```

Start the bot:

```bash
npm run dev
```

## Content and state

| Layer | Location | In git? |
|-------|----------|---------|
| Registry | `registry/*.json` | Yes — edit these to add translations, people, confessions |
| Built content | `CONTENT_DIR` (default `./content/`) | No — produced by `npm run sync-content` |
| Runtime state | `STATE_DIR` (default `~/.tyndale`) | No — user/guild preferences |

Deploy sequence:

```bash
npm run sync-content    # incremental: only new/changed registry entries
npm start
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding a person, translation, or confession.

## Discord application setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Open **Bot** → **Add Bot** → copy the token into `.env`.
3. Enable **Message Content Intent** under **Privileged Gateway Intents** (required to read message text).
4. Turn **Public Bot** on if you want others to add Tyndale via an invite link.
5. Generate an invite URL under **OAuth2 → URL Generator**:
   - **Scopes:** `bot`, `applications.commands`
   - **Permissions:** View Channels, Send Messages, Read Message History, Create Public Threads, Send Messages in Threads

Optional: set `DISCORD_GUILD_ID` in `.env` during development to register slash commands to one server instantly (guild commands). Leave it unset for global commands in production.

## Usage

Post a bracket citation in any channel the bot can read. Tyndale replies with an embed containing the verse text.

| Syntax | Example |
|--------|---------|
| Single verse | `[Gen 1:1]` |
| Verse range | `[Gen 1:1-3]` |
| Multiple verses | `[Gen 1:1,3,5]` |
| Full book name | `[Genesis 1:1]` |
| Translation prefix | `[ASV Gen 1:1]`, `[KJV John 3:16]`, `[Tyndale Gen 1:1]` |
| Whole chapter | `[Ps 150]`, `[Ps 150:5-end]` |
| Cross-chapter range | `[Gen 1:1-2:3]`, `[Gen 1-2]` |
| Westminster Confession | `[WCF 1.1]`, `[WCF 1.1-3]`, `[WCF 1]`, `[WCF 1.2-end]` |
| 1689 London Baptist Confession | `[LBCF 26.2]`, `[LBCF 26.1-4]`, `[LBCF 26]`, `[LBCF 26.end]` |
| Bot help | `/help`, `[Tyndale help]` |
| Bot status | `[Tyndale status]` |
| Server defaults | `[Tyndale server status]` |
| Your default translation | `/version show`, `/version set`, `/version clear` |
| Server default translation | `/server version show`, `/server version set`, `/server version clear` |
| Your text layout | `[Tyndale format]` |
| Set your text layout | `[Tyndale format verse]`, `[Tyndale format literary]`, `[Tyndale format paragraph]` |
| Reset your text layout | `[Tyndale format reset]` |
| Server text layout | `[Tyndale server format]` |
| Set server text layout | `[Tyndale server format verse]` |
| Reset server text layout | `[Tyndale server format reset]` |
| Church history lookup | `/person`, `[Tyndale person William Tyndale]` |

The bot ignores brackets that do not look like citation attempts (e.g. `[hello world]`). Book names, abbreviations, and translation codes are case-insensitive (`[gen 1:1]` and `[GEN 1:1]` both work). Default translation priority is: explicit prefix → your setting → server setting → bot env default. Default text layout priority is the same: your setting → server setting → `DEFAULT_TEXT_FORMAT` env (`literary`, `paragraph`, or `verse`). **Literary** uses each translation's own USFM layout when index files are present: poetry line breaks and indents where marked, prose paragraph groupings where `\p` markers exist. YLT uses verse-per-line prose in literary mode. Tyndale USFM covers the New Testament only; WYC layout comes from a modern-spelling Wycliffe USFM (structure may not match the Middle English verse text exactly). **Paragraph** always joins verses together. **Verse** always puts each verse on its own line.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the bot with hot reload |
| `npm run sync-content` | Sync registry → content (incremental) |
| `npm run build-data` | Full content rebuild (`sync-content --full`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled bot |
| `npm test` | Run tests |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint `src/` |

## Bible text attribution

Tyndale uses public-domain Bible texts:

- **WEB** — [World English Bible Updated (WEBU)](https://github.com/ringletech/webu-open-bible), CC0
- **ASV** — American Standard Version (1901), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- **YLT** — Young's Literal Translation (1898), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- **KJV** — King James Version (1769), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- **Geneva** — Geneva Bible (1599), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- **Tyndale** — Tyndale Bible (1526/1531), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- **WYC** — Wycliffe Bible (1388), via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases). Apocryphal/deuterocanonical books in the source are omitted.

Literary layout structure (paragraph and poetry markers) is parsed from [ebible.org](https://ebible.org/) USFM for WEB, ASV, YLT, KJV, Geneva, Tyndale (NT), and WYC (modern-spelling edition).

Confession text (public domain):

- **WCF** — Westminster Confession of Faith (1646), via [christian-standards](https://github.com/ReformedDevs/christian-standards)
- **LBCF** — 1689 London Baptist Confession, via [christian-standards](https://github.com/ReformedDevs/christian-standards)

## Health checks

There is no HTTP server. Check whether the bot is running via:

- Online/offline status in the Discord member list
- `[Tyndale help]` for citation syntax and bot commands
- `[Tyndale status]` in any server (uptime, gateway latency, loaded translations)
