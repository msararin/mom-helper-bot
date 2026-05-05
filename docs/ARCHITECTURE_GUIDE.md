# Mom Helper Bot Architecture Guide

## Purpose

This repository is both:
- a working household LINE bot
- a portfolio-style prototype that demonstrates practical architectural thinking

The goal is not to over-engineer the codebase.

The goal is to show a credible path from MVP to maintainable system while keeping the core workflow stable.

## Current Working Scope

The bot currently supports:
- adding inventory items from LINE messages
- viewing current inventory
- suggesting meals from inventory
- ranking menus from `Menu_Catalog`
- applying lightweight household preference scoring

## Current Runtime Architecture

```text
LINE Official Account
  -> Cloudflare Worker
    -> LINE adapter
    -> Apps Script adapter
      -> Google Apps Script Web App
        -> Google Sheets
```

## Current Code Structure

```text
src/
  index.js

  adapters/
    appsScriptAdapter.js
    lineAdapter.js

  services/
    menuSuggestionService.js

  utils/
    thaiParsing.js

test/
  helpers.js
  regression/
    line-flow.test.js
  unit/
    bot-logic.test.js
```

## Responsibility Split

### `src/index.js`

Current role:
- Worker entry point
- request verification
- admin route handling
- LINE event orchestration
- mode switching

It is intentionally thinner than the original MVP version.

It still contains orchestration logic, but no longer carries all parsing and suggestion logic in one file.

### `src/adapters/appsScriptAdapter.js`

Responsible for:
- calling Google Apps Script
- normalizing request/response boundaries
- hiding fetch details from the orchestration layer

Why:
- makes future migration away from Apps Script easier
- keeps external integration concerns out of bot flow logic

### `src/adapters/lineAdapter.js`

Responsible for:
- replying to LINE
- building the main quick-reply menu

Why:
- keeps LINE-specific payload shape out of the rest of the application

### `src/services/menuSuggestionService.js`

Responsible for:
- inventory normalization
- menu catalog normalization
- household preference normalization
- menu scoring
- user-facing inventory and menu formatting

Why:
- centralizes application behavior for `ดูของในตู้` and `คิดเมนู`
- gives a clean place to evolve menu logic without bloating the Worker entry point

### `src/utils/thaiParsing.js`

Responsible for:
- Thai inventory parsing
- speech-to-text tolerant parsing
- item normalization
- unit normalization
- default purchase date logic

Why:
- this is the most domain-specific logic in the project
- it benefits from focused unit tests

## Design Decisions

### 1. Keep the Worker as the main gateway

Recommendation used:
- Worker as the single public entry point

Why:
- central auth and validation point
- easier to add logging and guardrails later
- avoids exposing Apps Script directly as the main application surface

Tradeoff:
- a little more orchestration in Worker code
- but much cleaner system boundaries

### 2. Use Google Sheets as the editable data layer

Recommendation used:
- keep inventory, menu catalog, and household preferences in Sheets

Why:
- easy for household/admin editing
- no separate DB operations burden
- good enough for current scale

Tradeoff:
- weaker schema guarantees than a database
- Apps Script contract must stay disciplined

### 3. Treat `Fridge` and `Fridge_Log` differently

Recommendation used:
- `Fridge` = current inventory state
- `Fridge_Log` = append-only history

Why:
- matches real-world mental model
- avoids duplicate rows in current state
- preserves traceability of what was added

### 4. Prioritize regression safety over aggressive refactor speed

Recommendation used:
- light refactors first
- keep production behavior stable
- expand tests as structure improves

Why:
- this bot already works for real usage
- breaking the working flow would reduce both product value and portfolio value

## Testing Layout

### `test/regression/line-flow.test.js`

Covers end-to-end bot behavior such as:
- main menu response
- add-item flow
- inventory view flow
- menu suggestion flow
- admin auth and fridge merge behavior

### `test/unit/bot-logic.test.js`

Covers pure logic such as:
- Thai parsing
- unit normalization
- inventory normalization
- menu scoring
- format stability
- source-of-truth behavior for `Menu_Catalog`

## What This Repository Shows Well Now

- MVP delivery with real deployment
- regression-first iteration discipline
- adapter extraction without over-engineering
- Thai speech-to-text aware parsing
- data-driven menu suggestions
- practical separation between current state and history

## What Is Still Intentionally Deferred

These are valid next steps, but not required for the current stable core:
- fuller handler/use-case split
- explicit guardrail modules
- medication reminder module
- meal history feedback loop
- deeper preference policy engine
- future RAG-oriented context governance

## Near-Term Refactor Direction

The next safe structural step would be:

1. keep `index.js` as orchestration only
2. extract admin route handling into its own module
3. extract mode-state helpers into a service
4. optionally add `config/env.js`

This would improve architecture clarity without forcing a heavy enterprise structure too early.
