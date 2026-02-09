# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webshot is a CLI tool that takes a screenshot of a given URL and saves it as a JPEG. It uses Playwright (Chromium) for browser automation and Sharp for image conversion (PNG -> JPEG with mozjpeg).

## Commands

- `pnpm install` — install dependencies (postinstall automatically runs `playwright install --with-deps chromium`)
- `pnpm shot <url>` — take a screenshot of the given URL, saved to `./screenshots/<hostname>.jpg`

## Architecture

Single-file tool (`screenshot.js`):
1. Parses a URL from CLI args (auto-prepends `https://` if missing)
2. Derives output filename from hostname (e.g. `image21.cdom.cz` -> `image21-cdom-cz.jpg`)
3. Launches headless Chromium at 1920x1080 viewport, navigates with `waitUntil: "networkidle"`
4. Captures a viewport-only PNG screenshot, converts to JPEG (quality 88, mozjpeg) via Sharp
5. Saves to `./screenshots/` directory

## Tech Stack

- **Runtime**: Node.js 22 (managed via Volta)
- **Package manager**: pnpm 10
- **Dependencies**: playwright, sharp