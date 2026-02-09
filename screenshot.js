#!/usr/bin/env node
/**
 * Usage:
 *   pnpm shot https://example.com/
 *   pnpm shot https://example.com https://example.org
 *
 * Output:
 *   ./screenshots/example-com.jpg
 */

const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");

const VIEWPORT_WIDTH = 1920;
const JPG_QUALITY = 80;
const OUTPUT_DIR = "screenshots"; // samostatný adresář pro výstupy
const CONCURRENCY = 4; // max počet paralelních screenshotů

function sanitizeHostToFilename(hostname) {
    // example.com -> example-com
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

async function takeScreenshot(browser, url, outputDir, progress) {
    const fileBase = sanitizeHostToFilename(url.hostname);
    const outputFile = path.join(outputDir, `${fileBase}.jpg`);
    const host = url.hostname;

    const page = await browser.newPage({
        viewport: { width: VIEWPORT_WIDTH, height: 800 },
        deviceScaleFactor: 1,
    });

    try {
        console.log(`⏳ ${host} — načítám…`);

        // Framer Motion respektuje prefers-reduced-motion — animace přeskočí na finální stav
        await page.emulateMedia({ reducedMotion: "reduce" });

        await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: 45000,
        });

        // Pomalu proscrollujeme celou stránku, aby se spustily whileInView animace
        // Po každém kroku čekáme na ustálení DOM (Framer píše inline style každý rAF)
        const scrollStep = 400; // menší kroky = víc prvků se triggerne
        await page.evaluate(async (step) => {
            const waitForStability = () =>
                new Promise((resolve) => {
                    let lastMut = Date.now();
                    const obs = new MutationObserver(() => { lastMut = Date.now(); });
                    obs.observe(document.body, {
                        attributes: true, attributeFilter: ["style", "class"],
                        subtree: true, childList: true,
                    });
                    const id = setInterval(() => {
                        if (Date.now() - lastMut > 350) {
                            clearInterval(id); obs.disconnect(); resolve();
                        }
                    }, 50);
                    setTimeout(() => { clearInterval(id); obs.disconnect(); resolve(); }, 4000);
                });

            for (let y = 0; y < document.body.scrollHeight; y += step) {
                window.scrollTo(0, y);
                await waitForStability();
            }
            // Scroll na úplný konec
            window.scrollTo(0, document.body.scrollHeight);
            await waitForStability();

            // Zpět nahoru a počkat na finální ustálení
            window.scrollTo(0, 0);
            await waitForStability();
        }, scrollStep);

        const pngBuffer = await page.screenshot({
            type: "png",
            fullPage: true,
        });

        await sharp(pngBuffer)
            .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
            .toFile(outputFile);

        progress.done++;
        console.log(`✅ [${progress.done}/${progress.total}] ${host} -> ${outputFile}`);
    } catch (err) {
        progress.done++;
        console.error(`❌ [${progress.done}/${progress.total}] ${host} — ${err.message}`);
        process.exitCode = 1;
    } finally {
        await page.close();
    }
}

(async () => {
    const rawArgs = process.argv.slice(2);
    if (rawArgs.length === 0) {
        console.error("Chyba: zadej URL, např. pnpm shot https://example.com/");
        process.exit(1);
    }

    const urls = rawArgs.map(ensureUrl);
    const total = urls.length;
    const progress = { done: 0, total };

    console.log(`🚀 Spouštím screenshot pro ${total} URL (paralelně max ${CONCURRENCY})…\n`);

    const outputDir = path.resolve(process.cwd(), OUTPUT_DIR);
    await fs.mkdir(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    try {
        // Paralelní zpracování s omezenou concurrency
        const queue = [...urls];
        const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
            while (queue.length > 0) {
                const url = queue.shift();
                await takeScreenshot(browser, url, outputDir, progress);
            }
        });
        await Promise.all(workers);
    } finally {
        await browser.close();
    }

    console.log(`\n🏁 Hotovo — ${progress.done}/${total} screenshotů.`);
})();