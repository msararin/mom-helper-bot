# Version 1.1.2

## Summary

Closed the current food suggestion iteration with improved menu quality and safer regression coverage.

## What Changed

- Improved `คิดเมนู` suggestions to feel more like practical Thai home cooking
- Prioritized more realistic combinations from available ingredients
- Reduced overly generic menu suggestions in the main recommendation path
- Updated regression tests to lock the new menu output before deploy

## Why This Release Matters

This release closes the current menu-idea iteration in a stable state before moving on to future work such as menu catalogs, household preferences, and medication reminders.

## Current Limitations

- Menu suggestions are still rule-based in code
- Menu catalog from Google Sheets has not been implemented yet
- Household preference scoring is intentionally deferred to a later iteration
