#!/usr/bin/env node
/**
 * scripts/grade-photo.mjs - crop, resize and grade a photo into one of the site's black-and-white looks.
 *
 *   node scripts/grade-photo.mjs <in> <out> <left> <top> <width> <height> <outWidth> [quality=84] [look=classic]
 *
 * The crop box is in the source's pixels (after EXIF rotation). Each look maps luminance onto a tone
 * ramp, after contrast and an S-curve:
 *   classic  a duotone from near-black to warm paper (the site's dark bg and fg).
 *   mono     neutral grey, no warm tint: softly lifted blacks, a gentle vignette and a little
 *            sharpening.
 * Originals live in photos-raw/ (git-ignored); only the graded output is committed. iPhone HEIC
 * files are converted with macOS `sips` first (sharp's prebuilt libvips can't decode HEVC).
 *
 * The committed assets were made with:
 *   node scripts/grade-photo.mjs photos-raw/IMG_1597.heic src/assets/photos/portrait.jpg         0    0 2268 3780 1400 84 mono
 *   node scripts/grade-photo.mjs photos-raw/IMG_1597.heic src/assets/photos/portrait-face.jpg  661  964 1500 1500  640
 *   node scripts/grade-photo.mjs photos-raw/IMG_1597.heic src/assets/photos/og-portrait.jpg    430  650 1838 2939  324 86
 *   node scripts/grade-photo.mjs photos-raw/IMG_1616.HEIC src/assets/photos/boat-rail.jpg        0  950 3213 4284 1400 84 mono
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

/** Tone ramps are [position, [r, g, b]] stops; contrast and curve shape luminance before the ramp. */
const LOOKS = {
  classic: { contrast: 1.2, curve: 0.4, vignette: 0, sharpen: false, stops: [[0, [14, 14, 15]], [1, [232, 228, 220]]] },
  mono: {
    contrast: 1.12,
    curve: 0.35,
    vignette: 0.14, // how much the corners darken
    sharpen: true,
    stops: [[0, [20, 20, 20]], [1, [236, 236, 236]]],
  },
};

const [input, output, left, top, width, height, outWidth, quality = '84', lookName = 'classic'] = process.argv.slice(2);
const look = LOOKS[lookName];
if (!outWidth || !look) {
  console.error('Usage: node scripts/grade-photo.mjs <in> <out> <left> <top> <width> <height> <outWidth> [quality] [classic|mono]');
  process.exit(1);
}

/** The ramp's colour at x (0-1). */
function tone(x) {
  const { stops } = look;
  const i = Math.max(1, stops.findIndex(([at]) => at >= x));
  const [a, from] = stops[i - 1];
  const [b, to] = stops[i];
  const t = (x - a) / (b - a);
  return from.map((value, c) => value + (to[c] - value) * t);
}

let source = input;
let scratch;
if (/\.hei[cf]$/i.test(input)) {
  scratch = mkdtempSync(join(tmpdir(), 'grade-photo-'));
  source = join(scratch, 'source.jpg');
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', input, '--out', source], { stdio: 'ignore' });
}

try {
  let pipeline = sharp(source)
    .rotate()
    .extract({ left: +left, top: +top, width: +width, height: +height })
    .resize({ width: +outWidth });
  if (look.sharpen) pipeline = pipeline.sharpen({ sigma: 0.9, m1: 0.7, m2: 2.4 });
  const { data, info } = await pipeline.grayscale().raw().toBuffer({ resolveWithObject: true });

  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = y * info.width + x;
      let v = data[i * info.channels] / 255;
      v = Math.min(1, Math.max(0, 0.5 + (v - 0.5) * look.contrast));
      v = v * v * (3 - 2 * v) * look.curve + v * (1 - look.curve);
      if (look.vignette) {
        const dx = x / info.width - 0.5;
        const dy = y / info.height - 0.5;
        v *= 1 - look.vignette * Math.min(1, (dx * dx + dy * dy) * 2.2);
      }
      const [r, g, b] = tone(v);
      rgb[i * 3] = Math.round(r);
      rgb[i * 3 + 1] = Math.round(g);
      rgb[i * 3 + 2] = Math.round(b);
    }
  }

  const result = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .jpeg({ quality: +quality, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(output);
  console.log(`wrote ${output} ${result.width}x${result.height} ${Math.round(result.size / 1024)} KB`);
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
