# webshot

CLI tool for taking full-page screenshots of websites and saving them as optimized JPEGs.

## Features

- Full-page screenshots with lazy-load triggering (scrolls through the page to activate IntersectionObserver-based content)
- Parallel processing of multiple URLs (up to 4 concurrent)
- Real-time progress bars for each URL
- Optimized JPEG output via mozjpeg
- Auto-prepends `https://` if protocol is missing

## Prerequisites

- [Node.js](https://nodejs.org/) 22+ (managed via [Volta](https://volta.sh/))
- [pnpm](https://pnpm.io/) 10+

## Installation

```bash
pnpm install
```

This also installs Chromium via Playwright automatically.

## Usage

```bash
# Single URL
pnpm shot https://example.com

# Multiple URLs (processed in parallel)
pnpm shot https://example.com https://github.com https://nodejs.org
```

Screenshots are saved to `./screenshots/` as `<hostname>.jpg` (e.g. `example-com.jpg`).

## How It Works

1. Launches headless Chromium at 1920px width
2. Navigates to the URL and waits for network idle
3. Scrolls through the entire page to trigger lazy-loaded content and animations
4. Takes a full-page PNG screenshot
5. Converts to JPEG (quality 80) using Sharp with mozjpeg compression

## License

ISC