# Version 1.1.0

## Summary

Regression test pipeline added before deploy.

## What Changed

- Added automated regression tests with Node's built-in test runner
- Added test coverage for:
  - Thai inventory parsing
  - greeting vs inventory handling
  - main menu flow
  - add-item mode flow
  - inventory display
  - menu suggestion flow
- Added deploy gate so tests run before `wrangler deploy`
- Fixed Thai compact quantity parsing such as `สี่ร้อยกรัม`

## Why This Release Matters

This version reduces the risk of breaking the bot during future changes.
The project now has a basic safety net for parser and conversation regressions before deployment.

## Current Limitations

- Tests are still focused on Worker logic and mocked integrations
- No full end-to-end automated test with real LINE or real Google Apps Script
- Thai parsing remains heuristic and can still be improved further
