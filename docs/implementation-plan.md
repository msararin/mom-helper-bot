# MVP Implementation Plan

## Step 1: Project Skeleton

- Add `package.json` for local scripts and Wrangler dependency management
- Define the required environment variable names
- Choose a simple conversation state store

## State Choice

Use Cloudflare KV for conversation mode state.

Why KV for MVP:
- simple to set up
- enough for storing one small mode value per LINE user
- no separate database needed

Planned key shape:
- `user:<lineUserId>:mode`

Planned values:
- `adding_item`

## Required Secrets

Set these with Wrangler secrets. Do not commit them:
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

## Required Non-Secret Config

Set this as config or local env:
- `GOOGLE_APPS_SCRIPT_URL`
