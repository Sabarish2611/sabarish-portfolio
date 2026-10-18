# Sabarishwaran G — Portfolio

Personal portfolio of Sabarishwaran G, Data Scientist at Trellix. The concept is **"Signal from noise"**: an
editorial dark layout, a WebGL "latent space" hero where noisy points resolve into classes, and motion that
always moves from chaos to order.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components) · **React 19.3** · TypeScript
- **Tailwind CSS 4** (CSS-first tokens in `src/app/globals.css`)
- **GSAP 3.15** (ScrollTrigger, SplitText, DrawSVG) + **Lenis** smooth scroll, on a single shared frame loop
- **Motion** for UI micro-interactions · **three.js / React Three Fiber** for the hero
- **cmdk** for the ⌘K command menu

## Scripts

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint (React Compiler rules on)
npm run typecheck  # tsc --noEmit
npm run qa         # visual QA: desktop/mobile × dark/light × motion/reduced → qa-output/
```

`npm run qa` needs a running server (`BASE_URL` defaults to `http://localhost:3000`) and Playwright's Chromium
(`npx playwright install chromium`).

## Editing content

All facts live in two files. Components never hard-code them:

- `src/content/site.ts`: name, role, email, links, location, skills, experience and education
- `src/content/projects.ts`: the four case studies (copy, metrics, stack, visual)

The résumé served by the download links is `public/Sabarishwaran_G_Resume.pdf`.

## Theme and accent

- Dark is the default theme. Lime (`#C6F432`) is the default accent, and orange (`#FF5B1F`) is the alternative.
- Visitors can switch both from the header and the ⌘K menu. The choice is saved in `localStorage` and applied
  before first paint.
- To change the defaults, edit `DEFAULT_THEME` and `DEFAULT_ACCENT` in `src/lib/preferences.ts`.
- All colour tokens live in `src/app/globals.css` and were contrast-checked. In light mode the raw accent is
  only used as a fill; text and lines use the darker `--accent-ink`.

## Structure

```
src/
  app/              routes, metadata, OG images, sitemap/robots/manifest
  components/
    layout/         header, preloader, footer, cursor, command menu, mobile menu
    sections/       home page sections (hero, about, work, experience, toolkit, contact)
    work/           project cards, case-study page parts, illustrative visuals
    webgl/          the latent-space hero (lazy-loaded, client-only)
    ui/             shared primitives (RevealText, SectionHeader, Stat, Magnetic, ScrollLink)
    providers/      Lenis + GSAP bridge, Motion config
  content/          site + project data
  hooks/, lib/      media queries, clock, preferences, gsap setup, intro handshake
```

## Accessibility and performance

- `prefers-reduced-motion` turns off smooth scrolling, the preloader and entrance animations, and freezes the
  WebGL field on its final frame.
- Content stays readable without JavaScript.
- three.js is lazy-loaded and pauses rendering offscreen.
- Animations use transforms and opacity only.

## Deploy

Push the repo to GitHub and import it on Vercel. Set `NEXT_PUBLIC_SITE_URL` to the production domain so canonical
URLs, the sitemap and OG images use it.
