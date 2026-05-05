# mom-helper-bot

Mom Helper Bot is a LINE-based assistant that helps Mom decide what to buy at the market, what to cook, and what ingredients are available at home.

## Current Scope

- Receive messages from LINE
- Save ingredients to Google Sheet
- Support simple conversation modes:
  - add item
  - suggest menu
  - view inventory
- Use Cloudflare Worker as webhook endpoint
- Use Google Apps Script as bridge to Google Sheet

## Design Principle

Keep it simple, safe, and useful for daily family use.

## Current Working Features

- `เพิ่มของ`
- `ดูของในตู้`
- `คิดเมนู`
- `Fridge` merge-on-write inventory behavior
- `Fridge_Log` append-only history
- `Menu_Catalog` data-driven suggestions
- lightweight `Household_Preferences` scoring

## Architecture Snapshot

```text
LINE
  -> Cloudflare Worker
    -> adapters/
      -> lineAdapter
      -> appsScriptAdapter
    -> services/
      -> menuSuggestionService
    -> utils/
      -> thaiParsing
  -> Google Apps Script
    -> Google Sheets
```

For a fuller breakdown, see:
- [docs/ARCHITECTURE_GUIDE.md](docs/ARCHITECTURE_GUIDE.md)
- [docs/system-design.md](docs/system-design.md)

## Testing

This repo uses a regression-first workflow.

Run tests:

```bash
npm test
```

Current test layout:
- `test/regression/`
- `test/unit/`

## Release Notes

Stable core workflow release:
- [docs/release-v1.2.0.md](docs/release-v1.2.0.md)
