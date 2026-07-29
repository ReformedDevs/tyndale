# Tyndale

A Discord bot that responds to bracket Bible citations in messages — like `[Gen 1:1]` — with verse text from public-domain translations.

Supported translations: **WEB** (default), **ASV**, and **YLT**.

## Prerequisites

- Node.js 20+
- A [Discord application](https://discord.com/developers/applications) with a bot token

## Setup

```bash
git clone <repo-url>
cd tyndale
npm install
npm run build-data   # downloads WEB/ASV/YLT and writes data/*.json
cp .env.example .env
```

Add your bot token to `.env`:

```env
DISCORD_BOT_TOKEN=your_token_here
DEFAULT_TRANSLATION=web
LOG_LEVEL=info
```

Start the bot:

```bash
npm run dev
```

## Discord application setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Open **Bot** → **Add Bot** → copy the token into `.env`.
3. Enable **Message Content Intent** under **Privileged Gateway Intents** (required to read message text).
4. Turn **Public Bot** on if you want others to add Tyndale via an invite link.
5. Generate an invite URL under **OAuth2 → URL Generator**:
   - **Scopes:** `bot`
   - **Permissions:** View Channels, Send Messages, Read Message History, Create Public Threads, Send Messages in Threads

## Usage

Post a bracket citation in any channel the bot can read:

| Syntax | Example |
|--------|---------|
| Single verse | `[Gen 1:1]` |
| Verse range | `[Gen 1:1-3]` |
| Multiple verses | `[Gen 1:1,3,5]` |
| Full book name | `[Genesis 1:1]` |
| Translation prefix | `[ASV Gen 1:1]`, `[YLT John 3:16]` |
| Bot status | `[Tyndale status]` |

The bot ignores brackets that do not look like citation attempts (e.g. `[hello world]`). It replies with an error only when a bracket looks like a broken reference (e.g. `[Gen 1:3-10:]`, unknown book).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the bot with hot reload |
| `npm run build-data` | Download and build verse index files |
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

## Health checks

There is no HTTP server. Check whether the bot is running via:

- Online/offline status in the Discord member list
- `[Tyndale status]` in any server (uptime, gateway latency, loaded translations)
