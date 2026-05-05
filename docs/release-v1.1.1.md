# Version 1.1.1

## Summary

Parser and data-contract improvements for real Thai household usage, especially speech-to-text input from older users.

## What Changed

- Added broader household and kitchen unit support
- Normalized common unit aliases such as:
  - `โล` -> `กิโลกรัม`
  - `กก` -> `กิโลกรัม`
  - `แพ็ค` -> `แพ็ก`
  - `มล` -> `มิลลิลิตร`
- Added support for compact quantity/unit input such as:
  - `400กรัม`
  - `สี่ร้อยกรัม`
  - `ครึ่งโล`
- Improved parsing for speech-to-text style input without spaces
- Stripped noisy prefixes such as:
  - `พิมพ์`
  - `อ่าน`
  - `มี`
  - numbered list prefixes like `1.` and `2.`
- Added `purchase_date` to saved inventory items with default date on add
- Updated Google Apps Script example to match the production sheet structure:
  - `item`
  - `quantity`
  - `unit`
  - `expiry_date`
  - `note`
  - `updated_at`
  - `purchase_date`

## Why This Release Matters

This release makes the bot more usable for real family input patterns, especially when inventory is added through Thai speech-to-text with imperfect spacing and filler words.

## Current Limitations

- Thai parsing is still heuristic, not linguistic/NLP-based
- Some edge cases from speech recognition may still need targeted cleanup
- Expiry reminder logic has not been implemented yet
