# Release v1.2.0

## Summary

This release stabilizes the core `mom-helper-bot` workflow:

- add inventory
- view current inventory
- suggest meals from inventory

It also aligns production data behavior with the intended model:

- `Fridge` is now current state, not append-only history
- duplicate inventory entries merge quantities instead of creating new rows
- `Fridge_Log` remains the append-only history of additions

## User-facing changes

- `เพิ่มของ` supports Thai free text input better, including speech-to-text style input
- `ดูของในตู้` returns cleaner inventory output
- `คิดเมนู` reads from `Menu_Catalog` first and falls back to built-in menu rules when needed

## Data model changes

- `Fridge` now uses merge-on-write by `item + unit`
- `purchase_date` defaults to the current date when missing
- `Menu_Catalog` is now the main data source for menu suggestions

## Admin and operations

- Added Worker-based admin endpoints for controlled sheet operations
- Restricted admin access to whitelisted sheets:
  - `Fridge`
  - `Fridge_Log`
  - `Menu_Catalog`
  - `Meal_Log`
- Added `ADMIN_API_TOKEN` protection for admin routes

## Production cleanup completed

- cleaned `Fridge` item names
- removed blank `Menu_Catalog` rows
- deduplicated `Menu_Catalog` by `menu_name`

## Regression coverage

Current automated regression coverage includes:

- Thai item parsing
- compact quantity and unit parsing
- speech-to-text style inventory input
- casual chat rejection during add-item mode
- add-item save flow
- inventory formatting
- menu suggestion from `Menu_Catalog`
- menu ranking tie-break behavior
- `Fridge` merge behavior
- admin authentication behavior

Test status at release:

- `npm test` passed `28/28`

## Known limits

- household preferences are not yet part of menu scoring
- medication reminder remains in backlog
- admin APIs are available, but the main user-facing review target for this release is the core bot flow
