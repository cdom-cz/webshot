#!/usr/bin/env node
/**
 * Usage:
 *   pnpm shot https://image21.cdom.cz/
 *
 * Output:
 *   ./screenshots/image21-cdom-cz.jpg
 */

const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");

const FIXED_VIEWPORT = { width: 1920, height: 1080 }; // pevné rozlišení
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

(async () => {
    const rawArg = process.argv[2];
    if (!rawArg) {
        console.error("Chyba: zadej URL, např. pnpm shot https://image21.cdom.cz/");
        process.exit(1);
    }

    const url = ensureUrl(rawArg);
    const fileBase = sanitizeHostToFilename(url.hostname);

    const outputDir = path.resolve(process.cwd(), OUTPUT_DIR);
    await fs.mkdir(outputDir, { recursive: true }); // vytvoří složku, pokud chybí

    const outputFile = path.join(outputDir, `${fileBase}.jpg`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: FIXED_VIEWPORT,
        deviceScaleFactor: 1,
    });

    try {
        await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: 45000,
        });

        const pngBuffer = await page.screenshot({
            type: "png",
            fullPage: false,
        });

        await sharp(pngBuffer)
            .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
            .toFile(outputFile);

        console.log(`✅ Hotovo: ${outputFile}`);
    } catch (err) {
        console.error("❌ Nepodařilo se vytvořit screenshot:", err.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();