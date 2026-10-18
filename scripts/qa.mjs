#!/usr/bin/env node
/**
 * scripts/qa.mjs - automated visual QA (Playwright 1.64.x, Chromium only).
 *
 *   BASE_URL=http://localhost:3000 node scripts/qa.mjs
 *
 * Matrix: desktop 1440x900 + mobile 390x844  x  dark + light  x  motion + reduced-motion (8 runs per route).
 * Output: OUT_DIR/<route>/<run>/NN-<section>.png, fullpage.png, pin-*.png, <run>.webm, and OUT_DIR/report.json
 *
 * App contract (recommended, everything degrades gracefully if missing):
 *   - <html data-ready="true"> once the intro loader has finished (immediately under reduced motion)
 *   - window.__lenis = lenisInstance   (NOT window.lenis: Lenis itself writes {version,...} metadata there)
 *   - window.__ScrollTrigger = ScrollTrigger (optional, lets the script force ScrollTrigger.update())
 *   - sections: <section id="about"> inside <main> (or [data-section="about"])
 *   - theme script reads localStorage[THEME_KEY] ('dark' | 'light') and sets <html data-theme>
 *   - [data-qa-mask] on non-deterministic UI (live clock, now playing); [data-qa-hide] on the custom cursor
 *
 * Env (all optional):
 *   BASE_URL (http://localhost:3000)  ROUTES ("/", comma list)  OUT_DIR (qa-output)  ONLY (run-name substring)
 *   SECTIONS (comma list of ids; default auto-discovers `main section[id], [data-section]`)
 *   READY_SELECTOR (html[data-ready="true"])  READY_TIMEOUT (10000)  THEME_KEY (theme)
 *   MASK ([data-qa-mask])  HIDE ([data-qa-hide])  CANVAS_SELECTOR (canvas)
 *   SETTLE_MS (1400)  SETTLE_REDUCED_MS (250)
 *   FULLPAGE=0  PINS=0  VIDEO=1  VIDEO_MATCH (desktop-dark-motion)  GPU=1 (macOS: real GPU via ANGLE/Metal)
 *   HEADED=1  FAIL_ON_ERROR=1  IGNORE (regex of console texts to ignore)
 */
import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const env = process.env;
const BASE_URL = (env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const ROUTES = (env.ROUTES ?? '/').split(',').map((s) => s.trim()).filter(Boolean);
const OUT_DIR = path.resolve(env.OUT_DIR ?? 'qa-output');
const ONLY = env.ONLY ?? '';
const SECTIONS = env.SECTIONS ? env.SECTIONS.split(',').map((s) => s.trim()).filter(Boolean) : null;
const READY_SELECTOR = env.READY_SELECTOR ?? 'html[data-ready="true"]';
const READY_TIMEOUT = Number(env.READY_TIMEOUT ?? 10_000);
const THEME_KEY = env.THEME_KEY ?? 'theme';
const MASK = env.MASK ?? '[data-qa-mask]';
const HIDE = env.HIDE ?? '[data-qa-hide]';
const CANVAS_SELECTOR = env.CANVAS_SELECTOR ?? 'canvas';
const SETTLE_MS = Number(env.SETTLE_MS ?? 1400);
const SETTLE_REDUCED_MS = Number(env.SETTLE_REDUCED_MS ?? 250);
const FULLPAGE = env.FULLPAGE !== '0';
const PINS = env.PINS !== '0';
const VIDEO = env.VIDEO === '1';
const VIDEO_MATCH = env.VIDEO_MATCH ?? 'desktop-dark-motion';
const GPU = env.GPU === '1';
const HEADED = env.HEADED === '1';
const FAIL_ON_ERROR = env.FAIL_ON_ERROR === '1';
const IGNORE = new RegExp(
  env.IGNORE ?? String.raw`Download the React DevTools|\[Fast Refresh\]|\[HMR\]|webpack-hmr`,
  'i',
);

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];
const THEMES = ['dark', 'light'];
const MOTIONS = [
  { name: 'motion', reducedMotion: 'no-preference' },
  { name: 'reduced', reducedMotion: 'reduce' },
];
// <nextjs-portal> = Next.js dev indicator/overlay. The screenshot `style` option pierces shadow DOM.
const SCREENSHOT_STYLE = `nextjs-portal{display:none!important} ${HIDE}{visibility:hidden!important}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (s) => String(s).replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home';
const pad = (n) => String(n).padStart(2, '0');

/** Injected before any app script via context.addInitScript(). Must be self-contained (it is serialized). */
function pageInit({ theme, themeKey }) {
  try {
    localStorage.setItem(themeKey, theme);
  } catch {}
  const qa = (window.__qaPerf = { cls: 0, clsAll: 0, shifts: [], longTasks: [], loaf: [], lcp: null });
  const describe = (n) => {
    if (!n || !n.tagName) return null;
    const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + (cls ? `.${cls}` : '');
  };
  const observe = (type, onEntry) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true });
    } catch {}
  };
  observe('layout-shift', (e) => {
    qa.clsAll += e.value;
    if (!e.hadRecentInput) qa.cls += e.value;
    if (e.value >= 0.001)
      qa.shifts.push({
        t: Math.round(e.startTime),
        value: +e.value.toFixed(4),
        hadRecentInput: e.hadRecentInput,
        sources: (e.sources ?? []).slice(0, 3).map((s) => describe(s.node)),
      });
  });
  observe('longtask', (e) => qa.longTasks.push({ t: Math.round(e.startTime), ms: Math.round(e.duration) }));
  observe('long-animation-frame', (e) =>
    qa.loaf.push({
      t: Math.round(e.startTime),
      ms: Math.round(e.duration),
      blockingMs: Math.round(e.blockingDuration ?? 0),
      scripts: (e.scripts ?? []).slice(0, 2).map((s) => ({ src: s.sourceURL, fn: s.sourceFunctionName, ms: Math.round(s.duration) })),
    }),
  );
  observe('largest-contentful-paint', (e) => {
    qa.lcp = { t: Math.round(e.startTime), size: e.size, el: describe(e.element) };
  });
}

function attachCollectors(page, run) {
  page.on('console', (msg) => {
    const type = msg.type(); // 'warning' (not 'warn')
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (IGNORE.test(text)) return;
    const { url, line, column } = msg.location();
    run.console.push({ type, text, url, line, column });
  });
  page.on('pageerror', (err) =>
    run.pageErrors.push({ name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 8).join('\n') }),
  );
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'unknown';
    // Aborted RSC prefetches / HMR sockets are normal in Next.js; keep them out of the error list.
    if (failure === 'net::ERR_ABORTED' && (/[?&]_rsc=/.test(req.url()) || req.resourceType() === 'websocket')) return;
    run.requestFailures.push({ url: req.url(), method: req.method(), resourceType: req.resourceType(), failure });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) run.httpErrors.push({ url: res.url(), status: res.status() });
  });
}

async function waitForReady(page) {
  const t0 = Date.now();
  const ready = await page
    .waitForSelector(READY_SELECTOR, { state: 'attached', timeout: READY_TIMEOUT })
    .then(() => true, () => false);
  // page.screenshot() also awaits document.fonts.ready, but explicit is better before measuring layout.
  const fonts = await page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
  return { ready, ms: Date.now() - t0, fonts };
}

/** Force <html data-theme> if the app did not pick the theme up from localStorage / prefers-color-scheme. */
async function enforceTheme(page, theme) {
  return page.evaluate((theme) => {
    const root = document.documentElement;
    const before = root.getAttribute('data-theme');
    if (before !== theme) root.setAttribute('data-theme', theme);
    return { before, forced: before !== theme };
  }, theme);
}

async function probeEnv(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const info = {
      webgl: gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null,
      media: {
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        dark: matchMedia('(prefers-color-scheme: dark)').matches,
        pointerFine: matchMedia('(pointer: fine)').matches,
        hover: matchMedia('(hover: hover)').matches,
      },
      dataTheme: document.documentElement.getAttribute('data-theme'),
      lenis: { version: window.lenisVersion ?? null, instanceExposed: typeof window.__lenis?.scrollTo === 'function' },
      gsapVersions: window.gsapVersions ?? null,
      scrollTriggerExposed: typeof window.__ScrollTrigger?.update === 'function',
      dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight],
      docHeight: document.documentElement.scrollHeight,
    };
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return info;
  });
}

/** Instant jump that keeps Lenis + ScrollTrigger in sync. target = section id | y (px). Returns final scrollY or null. */
async function jumpTo(page, target) {
  return page.evaluate(async (target) => {
    let y = target;
    if (typeof target === 'string') {
      const el = document.getElementById(target) ?? document.querySelector(`[data-section="${CSS.escape(target)}"]`);
      if (!el) return null;
      y = el.getBoundingClientRect().top + window.scrollY;
    }
    const lenis = window.__lenis;
    if (lenis && typeof lenis.scrollTo === 'function') lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: 'instant' });
    window.__ScrollTrigger?.update?.();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.round(window.scrollY);
  }, target);
}

async function waitForScrollIdle(page, timeout = 6000) {
  await page.evaluate(
    (timeout) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        let last = window.scrollY;
        let still = 0;
        const tick = () => {
          const y = window.scrollY;
          still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
          last = y;
          if (still >= 12 || performance.now() - t0 > timeout) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    timeout,
  );
}

async function startFrameMeter(page) {
  await page.evaluate(() => {
    const m = (window.__qaFrames = { gaps: [], last: 0, on: true, t0: performance.now() });
    const tick = (t) => {
      if (!m.on) return;
      if (m.last) m.gaps.push(t - m.last);
      m.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () =>
    page.evaluate(() => {
      const m = window.__qaFrames;
      m.on = false;
      const secs = (performance.now() - m.t0) / 1000;
      const g = [...m.gaps].sort((a, b) => a - b);
      const q = (p) => (g.length ? +g[Math.min(g.length - 1, Math.floor(p * g.length))].toFixed(1) : null);
      return {
        seconds: +secs.toFixed(1),
        frames: g.length,
        avgFps: +(g.length / secs).toFixed(1),
        p50FrameMs: q(0.5),
        p95FrameMs: q(0.95),
        maxFrameMs: g.length ? +g[g.length - 1].toFixed(1) : null,
        framesOver50ms: g.filter((x) => x > 50).length,
      };
    });
}

/**
 * Scroll top -> bottom with real input so Lenis smoothing + every ScrollTrigger (`once`, lazy media, lazy 3D) fires.
 * Desktop: mouse.wheel (does not wait for the scroll to finish, hence the sleep). Mobile: CDP touch scroll gesture.
 */
async function scrollThrough(page, combo) {
  const { width, height } = combo.viewport;
  const cdp = combo.hasTouch ? await page.context().newCDPSession(page).catch(() => null) : null;
  await page.mouse.move(Math.round(width / 2), Math.round(height / 2));
  const stopMeter = await startFrameMeter(page);
  let stuck = 0;
  let lastY = -1;
  for (let i = 0; i < 400 && stuck < 6; i++) {
    const { y, max } = await page.evaluate(() => ({
      y: window.scrollY,
      max: document.documentElement.scrollHeight - window.innerHeight,
    }));
    if (y >= max - 2) break;
    stuck = Math.abs(y - lastY) < 1 ? stuck + 1 : 0;
    lastY = y;
    if (cdp) {
      await cdp
        .send('Input.synthesizeScrollGesture', {
          x: Math.round(width / 2),
          y: Math.round(height * 0.75),
          yDistance: -Math.round(height * 0.5), // negative = scroll down
          speed: 1500,
          gestureSourceType: 'touch',
        })
        .catch(() => page.evaluate((d) => window.scrollBy(0, d), Math.round(height * 0.5)));
    } else {
      await page.mouse.wheel(0, Math.round(height * 0.45));
      await sleep(140);
    }
  }
  await waitForScrollIdle(page);
  await cdp?.detach().catch(() => {});
  return stopMeter();
}

/** GSAP wraps pinned elements in div.pin-spacer; return the scroll range of each pin. */
async function pinRanges(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.pin-spacer')]
      .map((spacer, i) => {
        const pinned = spacer.firstElementChild;
        const start = spacer.getBoundingClientRect().top + window.scrollY;
        const distance = spacer.offsetHeight - (pinned?.offsetHeight ?? 0);
        const name = pinned?.id || pinned?.getAttribute('data-section') || `pin-${i + 1}`;
        return { name, start: Math.round(start), end: Math.round(start + distance) };
      })
      .filter((p) => p.end - p.start > 10),
  );
}

async function discoverSections(page) {
  if (SECTIONS) return SECTIONS;
  return page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('main section[id], [data-section]')]
        .map((el) => el.id || el.getAttribute('data-section'))
        .filter(Boolean),
    ),
  ]);
}

async function shot(page, file, options = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, style: SCREENSHOT_STYLE, mask: [page.locator(MASK)], ...options });
  return path.relative(OUT_DIR, file);
}

function contextOptions(combo) {
  return {
    baseURL: BASE_URL,
    viewport: combo.viewport,
    deviceScaleFactor: combo.deviceScaleFactor,
    isMobile: combo.isMobile,
    hasTouch: combo.hasTouch,
    colorScheme: combo.theme,
    reducedMotion: combo.reducedMotion,
    locale: 'en-US',
    serviceWorkers: 'block',
  };
}

async function runCombo(browser, combo, route) {
  const run = {
    name: combo.name,
    route,
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    screenshots: [],
    sections: [],
    pins: [],
  };
  const settle = combo.reducedMotion === 'reduce' ? SETTLE_REDUCED_MS : SETTLE_MS;
  const dir = path.join(OUT_DIR, slug(route), combo.name);
  const context = await browser.newContext(contextOptions(combo));
  await context.addInitScript(pageInit, { theme: combo.theme, themeKey: THEME_KEY });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000); // first hit on `next dev` compiles the route
  page.setDefaultTimeout(30_000);
  attachCollectors(page, run);
  try {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    run.status = response?.status() ?? null;
    if (combo.reducedMotion !== 'reduce') {
      await sleep(350);
      run.screenshots.push(await shot(page, path.join(dir, '00-intro.png')));
    }
    run.ready = await waitForReady(page);
    run.theme = await enforceTheme(page, combo.theme);
    run.canvas = await page
      .waitForSelector(CANVAS_SELECTOR, { state: 'attached', timeout: 5000 })
      .then(() => true, () => false);
    run.env = await probeEnv(page);

    run.frames = await scrollThrough(page, combo); // warm-up pass (also the FPS sample)
    await jumpTo(page, 0);
    await sleep(settle);
    run.screenshots.push(await shot(page, path.join(dir, '01-top.png')));

    let n = 2;
    for (const id of await discoverSections(page)) {
      const y = await jumpTo(page, id);
      if (y === null) {
        run.sections.push({ id, missing: true });
        continue;
      }
      await sleep(settle);
      run.sections.push({ id, y, file: await shot(page, path.join(dir, `${pad(n++)}-${slug(id)}.png`)) });
    }

    if (PINS) {
      for (const pin of await pinRanges(page)) {
        for (const p of [0, 0.5, 1]) {
          const y = await jumpTo(page, Math.round(pin.start + (pin.end - pin.start) * p));
          await sleep(settle);
          const file = await shot(page, path.join(dir, `pin-${slug(pin.name)}-${Math.round(p * 100)}.png`));
          run.pins.push({ ...pin, progress: p, y, file });
        }
      }
    }

    if (FULLPAGE) {
      // Captures the CURRENT scroll state: pinned/fixed layers render once, scroll-linked states are not replayed.
      await jumpTo(page, 0);
      await sleep(settle);
      run.screenshots.push(await shot(page, path.join(dir, 'fullpage.png'), { fullPage: true, scale: 'css' }));
      await sleep(400); // full-page capture dispatches a resize event -> let ScrollTrigger.refresh() settle
    }

    run.perf = await page.evaluate(() => {
      const p = window.__qaPerf;
      if (!p) return null;
      return {
        cls: +p.cls.toFixed(4),
        clsAll: +p.clsAll.toFixed(4),
        shifts: p.shifts.slice(0, 20),
        longTaskCount: p.longTasks.length,
        longTaskTotalMs: p.longTasks.reduce((sum, t) => sum + t.ms, 0),
        longTasks: p.longTasks.slice(0, 20),
        loafCount: p.loaf.length,
        worstLoaf: [...p.loaf].sort((a, b) => b.ms - a.ms).slice(0, 5),
        lcp: p.lcp,
      };
    });
  } catch (err) {
    run.fatal = String(err?.stack ?? err);
  } finally {
    await context.close();
  }
  return run;
}

async function recordVideo(browser, combo, route) {
  const tmpDir = path.join(OUT_DIR, '.video-tmp');
  const context = await browser.newContext({
    ...contextOptions(combo),
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpDir, size: combo.viewport },
  });
  await context.addInitScript(pageInit, { theme: combo.theme, themeKey: THEME_KEY });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await waitForReady(page);
    await enforceTheme(page, combo.theme);
    await sleep(800);
    await scrollThrough(page, combo);
    await sleep(800);
    const video = page.video();
    await page.close();
    const file = path.join(OUT_DIR, slug(route), `${combo.name}.webm`);
    await video.saveAs(file); // waits until the page is closed and the file is complete
    await video.delete(); // remove the hashed original in tmpDir
    return path.relative(OUT_DIR, file);
  } finally {
    await context.close();
    await rm(tmpDir, { recursive: true, force: true });
  }
}

const combos = VIEWPORTS.flatMap((vp) =>
  THEMES.flatMap((theme) =>
    MOTIONS.map((m) => ({ ...vp, theme, reducedMotion: m.reducedMotion, name: `${vp.name}-${theme}-${m.name}` })),
  ),
).filter((c) => c.name.includes(ONLY));

const { version: playwrightVersion } = createRequire(import.meta.url)('playwright/package.json');
await mkdir(OUT_DIR, { recursive: true });
// Headless (default) uses chrome-headless-shell. WebGL works out of the box via SwiftShader (Playwright always passes
// --enable-unsafe-swiftshader). GPU=1 on macOS switches ANGLE to Metal = real GPU (faster, representative FPS).
// CHANNEL defaults to the full Chromium build (new headless): chrome-headless-shell 1248 segfaults
// at launch intermittently on macOS 27 and crashes on GPU screenshots of backdrop-filtered layers.
const browser = await chromium.launch({
  channel: env.CHANNEL ?? 'chromium',
  headless: !HEADED,
  args: GPU && process.platform === 'darwin' ? ['--use-angle=metal'] : [],
});
const report = {
  baseURL: BASE_URL,
  startedAt: new Date().toISOString(),
  playwright: playwrightVersion,
  browser: browser.version(),
  gpu: GPU,
  runs: [],
  videos: [],
};

try {
  for (const route of ROUTES) {
    for (const combo of combos) {
      process.stdout.write(`-> ${route} ${combo.name} ... `);
      const run = await runCombo(browser, combo, route);
      report.runs.push(run);
      console.log(
        run.fatal
          ? `FATAL: ${run.fatal.split('\n')[0]}`
          : `ok  ready=${run.ready?.ready} console=${run.console.length} pageErrors=${run.pageErrors.length} cls=${run.perf?.cls}`,
      );
      if (VIDEO && combo.name.includes(VIDEO_MATCH)) {
        report.videos.push(await recordVideo(browser, combo, route).catch((err) => ({ error: String(err) })));
      }
    }
  }
} finally {
  await browser.close();
}

const count = (pick) => report.runs.reduce((sum, r) => sum + pick(r), 0);
report.totals = {
  runs: report.runs.length,
  fatal: count((r) => (r.fatal ? 1 : 0)),
  notReady: count((r) => (r.ready && !r.ready.ready ? 1 : 0)),
  consoleErrors: count((r) => r.console.filter((c) => c.type === 'error').length),
  consoleWarnings: count((r) => r.console.filter((c) => c.type === 'warning').length),
  pageErrors: count((r) => r.pageErrors.length),
  requestFailures: count((r) => r.requestFailures.length),
  httpErrors: count((r) => r.httpErrors.length),
  maxCls: Math.max(0, ...report.runs.map((r) => r.perf?.cls ?? 0)),
};
await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nreport: ${path.join(OUT_DIR, 'report.json')}\n${JSON.stringify(report.totals)}`);
if (FAIL_ON_ERROR && (report.totals.fatal || report.totals.pageErrors || report.totals.consoleErrors)) process.exitCode = 1;
