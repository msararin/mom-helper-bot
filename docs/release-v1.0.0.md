# Version 1.0.0

## Summary

First working MVP of Mom Helper Bot on LINE.

## What Works

- Receives LINE webhook events through Cloudflare Worker
- Verifies LINE webhook signature
- Shows main menu:
  - เพิ่มของ
  - คิดเมนู
  - ดูของในตู้
- Supports add-item mode
- Parses simple Thai inventory input
- Saves parsed items to Google Apps Script / Google Sheets
- Reads inventory from Google Apps Script
- Shows current inventory from the sheet
- Suggests simple meal ideas from current inventory

## Current Limitations

- Thai parsing is still heuristic and not fully robust
- Some unit parsing cases still need improvement
- Menu suggestions are rule-based and intentionally simple
- Inventory rows are append-only and not yet merged or updated intelligently

## Notes

This version is intended as the first usable family MVP.
It is good enough for real testing in LINE with Mom before deeper parser and UX improvements.
