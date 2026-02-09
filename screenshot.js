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
const OUTPUT_DIR = "screenshots";
const CONCURRENCY = 4; // max parallel screenshots

function sanitizeHostToFilename(hostname) {
    // example.com -> example-com
    return hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/[^a-z0-9.-]/g, "")
        .replace(/\./g, "-");
}

// Phase weights for smooth progress (loading=20%, scroll=50%, screenshot=15%, converting=15%)
const PHASES = [
    { label: "loading",    start: 0,   end: 20  },
    { label: "scroll",     start: 20,  end: 70  },
    { label: "screenshot", start: 70,  end: 85  },
    { label: "converting", start: 85,  end: 100 },
];

function printProgress(slots) {
    const lines = slots.map((s) => {
        if (!s) return "";
        const pct = Math.round(s.pct);
        const filled = Math.round(pct / 5);
        const bar = "█".repeat(filled) + "░".repeat(20 - filled);
        const label = s.label || "";
        return `  ${s.host.padEnd(30)} ${bar} ${String(pct).padStart(3)}% ${label}`;
    });
    // Move cursor up and overwrite
    if (slots._printed) {
        process.stderr.write(`\x1b[${slots.length}A`);
    }
    process.stderr.write(lines.join("\n") + "\n");
    slots._printed = true;
}

function ensureUrl(input) {
    try {
        return new URL(input);
    } catch {
        return new URL(`https://${input}`);
    }
}

async function takeScreenshot(browser, url, outputDir, progress, slot) {
    const fileBase = sanitizeHostToFilename(url.hostname);
    const outputFile = path.join(outputDir, `${fileBase}.jpg`);
    const host = url.hostname;

    slot.host = host;
    slot.pct = 0;
    slot.label = "";

    const setPhase = (phaseIdx, sub = 0) => {
        const p = PHASES[phaseIdx];
        slot.pct = p.start + (p.end - p.start) * sub;
        slot.label = p.label;
        printProgress(progress.slots);
    };

    const page = await browser.newPage({
        viewport: { width: VIEWPORT_WIDTH, height: 800 },
        deviceScaleFactor: 1,
    });

    // Expose a callback so the browser can report scroll progress back to Node
    await page.exposeFunction("__reportScroll", (fraction) => {
        setPhase(1, fraction);
    });

    try {
        // 1) Loading page
        setPhase(0, 0);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: 45000,
        });
        setPhase(0, 1);

        // 2) Scroll — trigger whileInView / IntersectionObserver animations
        setPhase(1, 0);
        const scrollStep = 750;
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

            const totalH = document.body.scrollHeight;
            const steps = Math.ceil(totalH / step) + 2; // +2 for scroll-to-end and scroll-back
            let done = 0;

            for (let y = 0; y < totalH; y += step) {
                window.scrollTo(0, y);
                await waitForStability();
                done++;
                await window.__reportScroll(done / steps);
            }
            window.scrollTo(0, totalH);
            await waitForStability();
            done++;
            await window.__reportScroll(done / steps);

            window.scrollTo(0, 0);
            await waitForStability();
            await window.__reportScroll(1);
        }, scrollStep);

        // 3) Screenshot
        setPhase(2, 0);
        const pngBuffer = await page.screenshot({
            type: "png",
            fullPage: true,
        });
        setPhase(2, 1);

        // 4) Convert PNG -> JPEG
        setPhase(3, 0);
        await sharp(pngBuffer)
            .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
            .toFile(outputFile);

        progress.done++;
        slot.host = `✅ ${host}`;
        slot.pct = 100;
        slot.label = "";
        printProgress(progress.slots);
    } catch (err) {
        progress.done++;
        slot.host = `❌ ${host}`;
        slot.pct = 100;
        slot.label = "";
        printProgress(progress.slots);
        console.error(`   ${host}: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await page.close();
    }
}

(async () => {
    const rawArgs = process.argv.slice(2);
    if (rawArgs.length === 0) {
        console.error("Error: provide a URL, e.g. pnpm shot https://example.com/");
        process.exit(1);
    }

    const urls = rawArgs.map(ensureUrl);
    const total = urls.length;
    const workerCount = Math.min(CONCURRENCY, total);

    // Progress bar slots — one line per worker
    const slots = Array.from({ length: workerCount }, () => ({ host: "…", pct: 0, label: "" }));
    slots._printed = false;
    const progress = { done: 0, total, slots };

    console.log(`🚀 Taking screenshots of ${total} URL(s) (max ${workerCount} parallel)…\n`);
    // Reserve lines for the progress bar
    process.stderr.write("\n".repeat(workerCount));
    slots._printed = true;
    process.stderr.write(`\x1b[${workerCount}A`);
    printProgress(slots);

    const outputDir = path.resolve(process.cwd(), OUTPUT_DIR);
    await fs.mkdir(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    try {
        const queue = [...urls];
        const workers = Array.from({ length: workerCount }, async (_, i) => {
            while (queue.length > 0) {
                const url = queue.shift();
                await takeScreenshot(browser, url, outputDir, progress, slots[i]);
            }
        });
        await Promise.all(workers);
    } finally {
        await browser.close();
    }

    console.log(`\n🏁 Done — ${progress.done}/${total} screenshots.`);
})();