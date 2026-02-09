#!/usr/bin/env node
/**
 * Usage:
 *   pnpm shot https://image21.cdom.cz/
 *   pnpm shot https://example.com https://example.org
 *
 * Output:
 *   ./screenshots/image21-cdom-cz.jpg
 */

const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");

const VIEWPORT_WIDTH = 1920;
const JPG_QUALITY = 80;
const OUTPUT_DIR = "screenshots"; // samostatný adresář pro výstupy

function sanitizeHostToFilename(hostname) {
    // image21.cdom.cz -> image21-cdom-cz
    return hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/[^a-z0-9.-]/g, "")
        .replace(/\./g, "-");
}

function ensureUrl(input) {
    try {
        return new URL(input);
    } catch {
        return new URL(`https://${input}`);
    }
}

async function takeScreenshot(browser, url, outputDir) {
    const fileBase = sanitizeHostToFilename(url.hostname);
    const outputFile = path.join(outputDir, `${fileBase}.jpg`);

    const page = await browser.newPage({
        viewport: { width: VIEWPORT_WIDTH, height: 800 },
        deviceScaleFactor: 1,
    });

    try {
        await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: 45000,
        });

        const pngBuffer = await page.screenshot({
            type: "png",
            fullPage: true,
        });

        await sharp(pngBuffer)
            .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
            .toFile(outputFile);

        console.log(`✅ Hotovo: ${outputFile}`);
    } catch (err) {
        console.error(`❌ Nepodařilo se vytvořit screenshot ${url}: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await page.close();
    }
}

(async () => {
    const rawArgs = process.argv.slice(2);
    if (rawArgs.length === 0) {
        console.error("Chyba: zadej URL, např. pnpm shot https://image21.cdom.cz/");
        process.exit(1);
    }

    const urls = rawArgs.map(ensureUrl);

    const outputDir = path.resolve(process.cwd(), OUTPUT_DIR);
    await fs.mkdir(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    try {
        for (const url of urls) {
            await takeScreenshot(browser, url, outputDir);
        }
    } finally {
        await browser.close();
    }
})();