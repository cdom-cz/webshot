# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webshot is a CLI tool that takes full-page screenshots of one or more URLs and saves them as JPEGs. It uses Playwright (Chromium) for browser automation and Sharp for image conversion (PNG -> JPEG with mozjpeg).

## Commands

- `pnpm install` — install dependencies (postinstall automatically runs `playwright install --with-deps chromium`)
- `pnpm shot <url> [url2] [url3] ...` — take screenshots of the given URLs, saved to `./screenshots/<hostname>.jpg`

## Architecture

Single-file tool (`screenshot.js`):
1. Parses URLs from CLI args (auto-prepends `https://` if missing, strips `www.` prefix)
2. Derives output filename from hostname (e.g. `www.example.com` -> `example-com.jpg`)
3. Launches headless Chromium at 1920x800 viewport, navigates with `waitUntil: "networkidle"`
4. Scrolls through the entire page to trigger lazy-loaded content and IntersectionObserver animations, with DOM mutation stability checks
5. Captures a **full-page** PNG screenshot, converts to JPEG (quality 80, mozjpeg) via Sharp
6. Saves to `./screenshots/` directory

### Concurrency & Progress

- Processes up to 4 URLs in parallel (configurable via `CONCURRENCY` constant)
- Displays per-URL progress bars in stderr with weighted phases: loading (20%), scrolling (50%), screenshot (15%), converting (15%)

## Tech Stack

- **Runtime**: Node.js 22 (managed via Volta)
- **Package manager**: pnpm 10
- **Dependencies**: playwright, sharp
