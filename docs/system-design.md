# Maliwan System Design

## Goal

Build a lightweight assistant for Mom through LINE.

The assistant helps with:
1. Adding ingredients currently available at home
2. Suggesting meals from available ingredients
3. Suggesting what to buy at the evening market
4. Keeping inventory in Google Sheet

## Initial Architecture

LINE Official Account
→ Cloudflare Worker Webhook
→ Google Apps Script
→ Google Sheet

## MVP Components

### LINE
Used as the main user interface because Mom already uses LINE regularly.

### Cloudflare Worker
Receives webhook events from LINE and controls bot logic.

### Google Apps Script
Receives structured requests from Worker and writes data into Google Sheet.

### Google Sheet
Stores ingredient inventory.

## Current Known Working State

- LINE webhook is connected successfully
- Cloudflare Worker can receive messages
- Google Apps Script is connected
- Saving ingredients into Google Sheet has worked before
- Current issue: bot response fill needs refinement

## Design Direction

The assistant should be simple and not over-explain.
It should ask only one thing at a time.
It should avoid saving data unless the user is clearly in the correct mode.
