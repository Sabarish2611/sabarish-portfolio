"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PingDot } from "@/components/toolkit/ping";
import { cn } from "@/lib/cn";
import { readPaused, subscribePaused } from "@/lib/motion-pause";
import { CITIES, DESTINATIONS, citiesCaption, listOf } from "./cities";
import { WORLD_DOTS } from "./globe-dots";
import { SOUTH_INDIA } from "./south-india-states";

const RAD = Math.PI / 180;
/** The home view: South India, the whole globe in the card. */
const HOME = { lon: 78.5, lat: 13 };
/** The zoomed-in view's centre: the cities' middle, nudged west so the left-hand labels fit (and further
 * west on narrow cards, where the 11px labels take more of the width: see fitZoomCentre). */
const ZOOM_CENTRE = { lon: 78.3, lat: 11.94 };
const LAT_LIMIT = 40;
/** Globe radius as a share of the card's width (home) and the zoomed-in radius (the cities spread over ~42%). */
const HOME_RADIUS = 0.44;
const ZOOM_RADIUS = 0.42 / ((80.2707 - 76.9558) * RAD * Math.cos(12 * RAD));
/** Where the globe's centre sits, as a share of the card's height (a little high, for the button below). */
const CENTRE_Y = 0.47;
const IDLE_MS = 4000;
const ZOOM_MS = 1300;
const SWAY_DEG = 8;
const SWAY_PERIOD_S = 40;
/** The zoomed-in map's box, which the view stays inside once zoomed in (the map itself reaches further). */
const BOX = SOUTH_INDIA.box;
const CLIP = SOUTH_INDIA.clip;
/** The zoom range over which the dots inside the box cross-fade into the map (and the flights fade in). */
const MAP_FROM = 0.45;
const MAP_TO = 0.85;
/** Flights: one leaves or lands every STAGGER_S seconds; each takes FLIGHT_S (+ up to FLIGHT_SPREAD_S for the longest route). */
const STAGGER_S = 1.3;
const FLIGHT_S = 3.1;
const FLIGHT_SPREAD_S = 0.8;
/** How far a lane bulges from the straight line, as a share of the route's length. */
const BULGE = 0.2;
/** The trail behind a plane, as a share of the lane, in TRAIL_STEPS strokes fading out. */
const TRAIL = 0.16;
const TRAIL_STEPS = 6;
/** The ring at the hub when a plane lands. */
const LANDING_S = 0.9;
/**
 * World flights (zoomed out), out of and back into the hub along great circles: each takes WORLD_FLIGHT_S
 * plus up to WORLD_SPREAD_S for the longest route; one leaves or lands every WORLD_STAGGER_S.
 */
const WORLD_FLIGHT_S = 3.4;
const WORLD_SPREAD_S = 3.4;
const WORLD_STAGGER_S = 1.7;
/** An arc's lift above the surface at its middle, as a share of the radius, growing with its length (radians). */
const liftFor = (angle: number) => 0.04 + 0.1 * angle;
const ARC_SAMPLES = 48;
const WORLD_TRAIL = 0.06;
/** The zoom range over which the world flights fade out (and back in when zooming out). */
const WORLD_FROM = 0.12;
const WORLD_TO = 0.5;
/** The automatic zoom-in: this long after the globe is first half in view (the entrance turn, then about 6 s of world flights). */
const AUTO_ZOOM_MS = 7000;
/** Once per page load: set when the automatic zoom has run, or the visitor turned or zoomed the globe first. */
let autoZoomSpent = false;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeInOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const wrap = (x: number, m: number) => ((x % m) + m) % m;

type Flight = { start: number; duration: number; length: number };
/**
 * A clock time (s) at which every plane in the air is well clear of both ends of its lane (measured
 * along the route, so a short one's plane sits near its middle), with at least two in the air: the first
 * frame, frozen under the motion pause, shows planes mid-flight, none on a pin or landing.
 */
function restClock(flights: readonly Flight[], cycle: number) {
  let best = 0;
  let bestScore = -Infinity;
  for (let clock = 0; clock < cycle; clock += 0.05) {
    let margin = Infinity;
    let count = 0;
    for (const flight of flights) {
      const time = wrap(clock - flight.start, cycle);
      if (time >= flight.duration) continue;
      const t = easeInOutSine(time / flight.duration);
      margin = Math.min(margin, Math.min(t, 1 - t) * flight.length);
      count++;
    }
    const score = count >= Math.min(2, flights.length) ? margin * (1 + 0.05 * count) : -1;
    if (score > bestScore) {
      best = clock;
      bestScore = score;
    }
  }
  return best;
}

const toUnit = (lonDeg: number, latDeg: number) => ({
  x: Math.cos(latDeg * RAD) * Math.cos(lonDeg * RAD),
  y: Math.cos(latDeg * RAD) * Math.sin(lonDeg * RAD),
  z: Math.sin(latDeg * RAD),
});

function decode(mask: string, count: number) {
  const bytes = Uint8Array.from(atob(mask), (char) => char.charCodeAt(0));
  const on: number[] = [];
  for (let i = 0; i < count; i++) if (bytes[i >> 3]! & (1 << (i & 7))) on.push(i);
  return on;
}

/** Unit vectors of the land dots. */
function buildDots() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const world = decode(WORLD_DOTS.mask, WORLD_DOTS.count);
  const w = { x: new Float32Array(world.length), y: new Float32Array(world.length), z: new Float32Array(world.length) };
  world.forEach((i, k) => {
    const lat = Math.asin(1 - (2 * (i + 0.5)) / WORLD_DOTS.count);
    let lon = (i * golden) % (2 * Math.PI);
    if (lon > Math.PI) lon -= 2 * Math.PI;
    w.x[k] = Math.cos(lat) * Math.cos(lon);
    w.y[k] = Math.cos(lat) * Math.sin(lon);
    w.z[k] = Math.sin(lat);
  });
  return w;
}

/** One polyline string (see south-india-states.ts) as [lon, lat] pairs in hundredths of a degree. */
function decodeRing(text: string) {
  const out: number[] = [];
  let i = 0;
  const next = () => {
    let value = 0;
    let shift = 0;
    let chunk = 0;
    do {
      chunk = text.charCodeAt(i++) - 63;
      value |= (chunk & 0x1f) << shift;
      shift += 5;
    } while (chunk >= 0x20);
    return value & 1 ? ~(value >> 1) : value >> 1;
  };
  let x = 0;
  let y = 0;
  while (i < text.length) {
    x += next();
    y += next();
    out.push(x, y);
  }
  return out;
}

/**
 * A country's rings as unit vectors, ring k running from starts[k] to starts[k + 1]. skip[i] is 1 when the
 * edge from point i to the next runs along the clip box's edge (where it cut the land): filled, not stroked.
 */
function buildShape(rings: readonly string[]) {
  const decoded = rings.map(decodeRing);
  const total = decoded.reduce((n, ring) => n + ring.length / 2, 0);
  const shape = { x: new Float32Array(total), y: new Float32Array(total), z: new Float32Array(total), skip: new Uint8Array(total), starts: new Int32Array(rings.length + 1) };
  const edge = { lon: [CLIP.lon0 * 100, CLIP.lon1 * 100], lat: [CLIP.lat0 * 100, CLIP.lat1 * 100] };
  let k = 0;
  decoded.forEach((ring, r) => {
    shape.starts[r] = k;
    const n = ring.length / 2;
    for (let i = 0; i < n; i++, k++) {
      const lon = ring[2 * i]!;
      const lat = ring[2 * i + 1]!;
      const v = toUnit(lon / 100, lat / 100);
      shape.x[k] = v.x;
      shape.y[k] = v.y;
      shape.z[k] = v.z;
      const nLon = ring[(2 * i + 2) % ring.length]!;
      const nLat = ring[(2 * i + 3) % ring.length]!;
      shape.skip[k] = (lon === nLon && edge.lon.includes(lon)) || (lat === nLat && edge.lat.includes(lat)) ? 1 : 0;
    }
  });
  shape.starts[rings.length] = k;
  return shape;
}

/** A plane seen from above, nose along +x, about 11px long (half the outline, mirrored in y). */
const PLANE_HALF: readonly (readonly [number, number])[] = [
  [5.7, 0], [4.8, -0.7], [1.1, -0.8], [-1.5, -5.3], [-2.9, -5.3], [-1.5, -0.8],
  [-4, -0.7], [-5.1, -2.5], [-5.9, -2.5], [-5.2, -0.4], [-5.5, 0],
];
function planeGlyph() {
  const path = new Path2D();
  const outline = [...PLANE_HALF, ...PLANE_HALF.slice(1, -1).reverse().map(([x, y]) => [x, -y] as const)];
  outline.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

/** The subsolar point now, as a unit vector (low-precision solar ephemeris, plenty for a terminator). */
function sunVector(date: Date) {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const L = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * RAD;
  const lon = ra - gmst;
  return { x: Math.cos(dec) * Math.cos(lon), y: Math.cos(dec) * Math.sin(lon), z: Math.sin(dec) };
}

const subscribeNothing = () => () => {};

/** Where the flights come and go: the city Sabarish lives in now (site.location.city). */
const HUB_NAME = CITIES.find((city) => city.now)?.name;
const FLIGHTS_TEXT = HUB_NAME ? `, with an illustration of flights in and out of ${HUB_NAME}` : "";
const WORLD_TEXT =
  HUB_NAME && DESTINATIONS.length
    ? `an illustration of flights out of ${HUB_NAME} to ${listOf(DESTINATIONS.map((place) => place.name))} and back`
    : "";

/**
 * The cities Sabarish has lived in, on a live globe of land dots (Natural Earth, see
 * scripts/build-globe.mjs) in Contact's 3:4 card. The night side, from the sun's position now, is dimmer.
 * At home the four cities are one marker with a callout, and planes fly out of the city Sabarish lives in
 * now to the destinations in site.ts and back, on arcs lifted over the globe. The first time the card is
 * half in view, after the entrance turn and a few seconds of those, it zooms in on its own (unless the
 * visitor got there first); the button (or a double-click/tap) zooms in and out. Zoomed in, the pins
 * spread apart, labelled, and the dots cross-fade into a map of the states (1:10m) with planes flying in
 * and out of that city. All flights are an illustration, not real routes or trips. Drag turns the globe;
 * idle, it eases back and sways gently. Paused off-screen; frozen at home under the shared motion pause;
 * under reduced motion it starts zoomed in, static (the planes rest mid-lane).
 */
export function LivedInGlobe({ className }: { className?: string }) {
  const root = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toggleRef = useRef<(() => void) | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // False on the server and during hydration, so the button only renders where the globe runs.
  const live = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    const card = root.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!card || !canvas || !ctx) return;

    const dots = buildDots();
    const india = buildShape(SOUTH_INDIA.india);
    const neighbours = buildShape(SOUTH_INDIA.neighbours);
    const plane = planeGlyph();
    const pins = [...card.querySelectorAll<HTMLElement>("[data-globe-pin]")];
    const labels = [...card.querySelectorAll<HTMLElement>("[data-globe-label]")];
    const cluster = card.querySelector<HTMLElement>("[data-globe-cluster]");
    const calloutText = card.querySelector<HTMLElement>("[data-globe-callout]");
    const destPins = [...card.querySelectorAll<HTMLElement>("[data-globe-dest-pin]")];
    const destLabels = [...card.querySelectorAll<HTMLElement>("[data-globe-dest-label]")];
    const cities = CITIES.map((city) => toUnit(city.lon, city.lat));
    const dests = DESTINATIONS.map((place) => toUnit(place.lon, place.lat));
    const centroid = (() => {
      const s = cities.reduce((a, c) => ({ x: a.x + c.x, y: a.y + c.y, z: a.z + c.z }), { x: 0, y: 0, z: 0 });
      const n = Math.hypot(s.x, s.y, s.z);
      return { x: s.x / n, y: s.y / n, z: s.z / n };
    })();

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;
    let paused = readPaused();
    let visible = false;
    // The automatic zoom-in counts down (in time on screen, with motion allowed) once the card has been half in view.
    let armed = false;
    let autoLeft = AUTO_ZOOM_MS;
    let disposed = false;
    const motionOK = () => !reduced && !paused;

    // View: centre (degrees) and zoom (0 home … 1 zoomed in). The sway is added on top of the centre.
    let mode = 0;
    let zoomCentre = ZOOM_CENTRE;
    const home = () => (mode ? zoomCentre : HOME);
    const view = { lon: HOME.lon - (motionOK() ? 36 : 0), lat: HOME.lat, z: 0 };
    let sway = 0; // weight 0…1
    let swayPhase = 0;
    let anim: { from: typeof view; to: typeof view; start: number } | null = null;
    // live: past the drag threshold. Until then a press only holds the globe still, so a touch that turns
    // into a page scroll (pointercancel), or a tap, neither spends the auto-zoom nor stops a zoom part-way.
    let drag: { id: number; x: number; y: number; t: number; live: boolean } | null = null;
    let velocity = { x: 0, y: 0 }; // px/s, for inertia
    let lastInput = -Infinity; // so the entrance turn eases home straight away
    let lastTap = { t: -Infinity, x: 0, y: 0 };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let colors = { fg: "#fff", muted: "#999", line: "rgba(255,255,255,0.24)", accent: "#c6f432", bg: "#000" };
    let sun = sunVector(new Date());
    let dirty = true;
    let frame = 0;
    let wake = 0;
    let lastTime = 0;

    // Flights, an illustration: between the hub (where Sabarish lives now) and each other city, one lane
    // flown both ways, out and back half a cycle apart (so planes never meet mid-lane), departures and
    // arrivals interleaved across the routes.
    const hub = CITIES.findIndex((city) => city.now);
    const routes = hub < 0 ? [] : CITIES.map((_, i) => i).filter((i) => i !== hub);
    const routeAngle = routes.map((i) => Math.acos(Math.min(1, cities[hub]!.x * cities[i]!.x + cities[hub]!.y * cities[i]!.y + cities[hub]!.z * cities[i]!.z)));
    const longest = Math.max(...routeAngle, 1e-9);
    // At least twice the longest flight, so a route's outbound plane has landed before its inbound one leaves.
    const cycle = Math.max(2 * routes.length * STAGGER_S, 2 * (FLIGHT_S + FLIGHT_SPREAD_S), FLIGHT_S + FLIGHT_SPREAD_S + LANDING_S + 0.5);
    const flights = routes.flatMap((_, r) => [
      { route: r, out: true, start: 2 * r * STAGGER_S },
      { route: r, out: false, start: 2 * r * STAGGER_S + cycle / 2 },
    ]).map((flight) => ({
      ...flight,
      duration: FLIGHT_S + FLIGHT_SPREAD_S * (routeAngle[flight.route]! / longest),
      length: routeAngle[flight.route]!,
    }));
    const flightsRest = restClock(flights, cycle);
    let flightClock = flightsRest; // seconds; only advances while the flights are shown and motion is allowed

    // World flights, an illustration: one great-circle arc from the hub to each destination, lifted above
    // the surface (higher for longer routes), flown out and back; departures and arrivals interleaved.
    const arcs = (hub < 0 ? [] : dests).map((b) => {
      const a = cities[hub]!;
      const angle = Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
      return { a, b, angle, sin: Math.sin(angle) || 1, lift: liftFor(angle) };
    });
    const arcPoint = (arc: (typeof arcs)[number], t: number) => {
      const s0 = Math.sin((1 - t) * arc.angle) / arc.sin;
      const s1 = Math.sin(t * arc.angle) / arc.sin;
      return { x: s0 * arc.a.x + s1 * arc.b.x, y: s0 * arc.a.y + s1 * arc.b.y, z: s0 * arc.a.z + s1 * arc.b.z, h: arc.lift * Math.sin(Math.PI * t) };
    };
    const arcSamples = arcs.map((arc) => Array.from({ length: ARC_SAMPLES + 1 }, (_, k) => arcPoint(arc, k / ARC_SAMPLES)));
    const longestArc = Math.max(...arcs.map((arc) => arc.angle), 1e-9);
    const worldDurations = arcs.map((arc) => WORLD_FLIGHT_S + WORLD_SPREAD_S * (arc.angle / longestArc));
    const worldCycle = Math.max(2 * arcs.length * WORLD_STAGGER_S, 2 * (WORLD_FLIGHT_S + WORLD_SPREAD_S + 0.5));
    const worldFlights = arcs.flatMap((_, i) => [
      { arc: i, out: true, start: 2 * i * WORLD_STAGGER_S, duration: worldDurations[i]!, length: arcs[i]!.angle },
      { arc: i, out: false, start: 2 * i * WORLD_STAGGER_S + worldCycle / 2, duration: worldDurations[i]!, length: arcs[i]!.angle },
    ]);
    const worldRest = restClock(worldFlights, worldCycle);
    let worldClock = worldRest;
    // Where each destination's label sits, from its dot (top-left corner, px): chosen in placeLabels.
    const destOffset = dests.map(() => ({ x: 7, y: -9, w: 0, h: 0 }));
    // The projection of the last drawn frame, for the flights drawn over it.
    const proj = { cx: 0, cy: 0, R: 1, cl: 1, sl: 0, cp: 1, sp: 0 };
    // Zoomed in, the globe, map and lanes are drawn once per view into this layer, and each frame of the
    // flights copies it and draws the planes on top. Zoomed out, the globe draws straight to the canvas.
    const layer = document.createElement("canvas");
    const layerCtx = layer.getContext("2d");

    const readColors = () => {
      const style = getComputedStyle(card);
      colors = {
        fg: style.getPropertyValue("--fg").trim() || colors.fg,
        muted: style.getPropertyValue("--fg-muted").trim() || colors.muted,
        line: style.getPropertyValue("--line-strong").trim() || colors.line,
        accent: style.getPropertyValue("--accent-ink").trim() || colors.accent,
        bg: style.getPropertyValue("--bg-elevated").trim() || colors.bg,
      };
      dirty = true;
    };

    const radiusFor = (z: number) => width * HOME_RADIUS * (ZOOM_RADIUS / HOME_RADIUS) ** z;

    // Zoomed in, the view stays on the map's box: outside it the world dots are too far apart at that
    // scale and read as stars, not land.
    const clampToRegion = () => {
      if (!mode || anim) return;
      const R = radiusFor(view.z);
      const up = (height * CENTRE_Y) / R / RAD;
      const down = (height * (1 - CENTRE_Y)) / R / RAD;
      const side = width / 2 / R / RAD / Math.cos(view.lat * RAD);
      const { lon0, lon1, lat0, lat1 } = BOX;
      view.lon = lon1 - lon0 > 2 * side ? Math.max(lon0 + side, Math.min(lon1 - side, view.lon)) : (lon0 + lon1) / 2;
      view.lat = lat1 - lat0 > up + down ? Math.max(lat0 + down, Math.min(lat1 - up, view.lat)) : (lat0 + lat1) / 2;
    };

    // Buckets of dot positions by opacity, so each frame is a few fills instead of thousands.
    const LEVELS = 12;
    const buckets: number[][] = Array.from({ length: LEVELS + 1 }, () => []);

    const project = (v: { x: number; y: number; z: number }) => {
      const a = v.x * proj.cl + v.y * proj.sl;
      return { x: proj.cx + proj.R * (v.y * proj.cl - v.x * proj.sl), y: proj.cy - proj.R * (proj.cp * v.z - proj.sp * a) };
    };
    const setProjection = (lonDeg: number, latDeg: number, z: number) =>
      Object.assign(proj, {
        cx: width / 2,
        cy: height * CENTRE_Y,
        R: radiusFor(z),
        cl: Math.cos(lonDeg * RAD),
        sl: Math.sin(lonDeg * RAD),
        cp: Math.cos(latDeg * RAD),
        sp: Math.sin(latDeg * RAD),
      });
    // A point lifted h (share of the radius) above the surface: on screen, and whether it shows (on the
    // near side, or far enough out to clear the globe's disc).
    const lifted = (p: { x: number; y: number; z: number; h: number }) => {
      const a = p.x * proj.cl + p.y * proj.sl;
      const depth = proj.sp * p.z + proj.cp * a;
      const k = proj.R * (1 + p.h);
      return {
        x: proj.cx + k * (p.y * proj.cl - p.x * proj.sl),
        y: proj.cy - k * (proj.cp * p.z - proj.sp * a),
        on: depth > 0 || (1 + p.h) ** 2 * (1 - depth * depth) > 1,
      };
    };
    // A route's lane on screen: one quadratic curve from the hub to the city, bulging to the left of that
    // direction (so the lanes fan out, away from the hub's label below-right of its pin), flown both ways.
    const lane = (route: number) => {
      const a = project(cities[hub]!);
      const b = project(cities[routes[route]!]!);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return { a, b, c: { x: (a.x + b.x) / 2 + dy * BULGE, y: (a.y + b.y) / 2 - dx * BULGE } };
    };
    // A point t of the way along a flight (0 at take-off), heading the way the plane flies: inbound
    // flights run the lane from the city back to the hub.
    const along = (l: ReturnType<typeof lane>, t: number, out = true) => {
      const s = out ? t : 1 - t;
      const u = 1 - s;
      return {
        x: u * u * l.a.x + 2 * u * s * l.c.x + s * s * l.b.x,
        y: u * u * l.a.y + 2 * u * s * l.c.y + s * s * l.b.y,
        angle:
          Math.atan2(u * (l.c.y - l.a.y) + s * (l.b.y - l.c.y), u * (l.c.x - l.a.x) + s * (l.b.x - l.c.x)) + (out ? 0 : Math.PI),
      };
    };

    function draw(g: CanvasRenderingContext2D, lonDeg: number, latDeg: number, z: number) {
      const R = radiusFor(z);
      const cx = width / 2;
      const cy = height * CENTRE_Y;
      const cl = Math.cos(lonDeg * RAD);
      const sl = Math.sin(lonDeg * RAD);
      const cp = Math.cos(latDeg * RAD);
      const sp = Math.sin(latDeg * RAD);
      Object.assign(proj, { cx, cy, R, cl, sl, cp, sp });
      const map = smoothstep(MAP_FROM, MAP_TO, z);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      // The sphere: a faint body (gone under the map, whose sea is the card) and outline.
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.globalAlpha = 0.025 * (1 - map);
      g.fillStyle = colors.fg;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = colors.line;
      g.lineWidth = 1;
      g.stroke();

      // The map: land filled, Indian states outlined, the neighbouring countries a lighter fill. Projected
      // like the dots, so as they cross-fade it lands where they were.
      if (map > 0) {
        const outline = (shape: ReturnType<typeof buildShape>, borders: Path2D | null) => {
          const fill = new Path2D();
          for (let r = 0; r + 1 < shape.starts.length; r++) {
            const from = shape.starts[r]!;
            const to = shape.starts[r + 1]!;
            let firstX = 0;
            let firstY = 0;
            let pen = false;
            for (let i = from; i < to; i++) {
              const x = shape.x[i]!;
              const y = shape.y[i]!;
              const a = x * cl + y * sl;
              const px = cx + R * (y * cl - x * sl);
              const py = cy - R * (cp * shape.z[i]! - sp * a);
              if (i === from) {
                fill.moveTo(px, py);
                firstX = px;
                firstY = py;
              } else fill.lineTo(px, py);
              if (!borders) continue;
              if (pen) borders.lineTo(px, py);
              else borders.moveTo(px, py);
              pen = !shape.skip[i];
            }
            fill.closePath();
            if (borders && pen) borders.lineTo(firstX, firstY);
          }
          return fill;
        };
        const borders = new Path2D();
        g.fillStyle = colors.fg;
        g.globalAlpha = 0.04 * map;
        g.fill(outline(neighbours, null));
        g.globalAlpha = 0.07 * map;
        g.fill(outline(india, borders));
        g.globalAlpha = map;
        g.strokeStyle = colors.line;
        g.lineWidth = 1;
        g.lineJoin = "round";
        g.stroke(borders);
        g.globalAlpha = 1;
      }

      // The land dots, fading out as the map fades in (all of them: outside the map's box they'd read
      // as stars by the time it's in, and the view stays inside the box zoomed in).
      const pass = (set: { x: Float32Array; y: Float32Array; z: Float32Array }, spacing: number, weight: number) => {
        if (weight <= 0) return;
        const size = Math.min(2.6, Math.max(1, spacing * 0.34));
        const half = size / 2;
        const margin = size + 1;
        for (const bucket of buckets) bucket.length = 0;
        const n = set.x.length;
        for (let i = 0; i < n; i++) {
          const x = set.x[i]!;
          const y = set.y[i]!;
          const zz = set.z[i]!;
          const a = x * cl + y * sl;
          const depth = sp * zz + cp * a;
          if (depth <= 0) continue;
          const px = cx + R * (y * cl - x * sl);
          const py = cy - R * (cp * zz - sp * a);
          if (px < -margin || px > width + margin || py < -margin || py > height + margin) continue;
          const day = smoothstep(-0.06, 0.06, x * sun.x + y * sun.y + zz * sun.z);
          const alpha = weight * (0.16 + 0.84 * depth) * (0.3 + 0.7 * day) * 0.9;
          const level = Math.round(alpha * LEVELS);
          if (level > 0) buckets[level]!.push(px - half, py - half);
        }
        g.fillStyle = colors.fg;
        const round = size >= 2.2;
        for (let level = 1; level <= LEVELS; level++) {
          const bucket = buckets[level]!;
          if (!bucket.length) continue;
          g.globalAlpha = level / LEVELS;
          g.beginPath();
          for (let k = 0; k < bucket.length; k += 2) {
            if (round) {
              g.moveTo(bucket[k]! + size, bucket[k + 1]! + half);
              g.arc(bucket[k]! + half, bucket[k + 1]! + half, half, 0, Math.PI * 2);
            } else g.rect(bucket[k]!, bucket[k + 1]!, size, size);
          }
          g.fill();
        }
      };
      pass(dots, Math.sqrt((4 * Math.PI) / WORLD_DOTS.count) * R, 1 - map);

      // The world flights' arcs: faint dashed lines, hidden where they pass behind the globe; fading out
      // as the zoom-in proceeds.
      const world = 1 - smoothstep(WORLD_FROM, WORLD_TO, z);
      if (world > 0 && arcs.length) {
        g.beginPath();
        for (const samples of arcSamples) {
          let pen = false;
          for (const sample of samples) {
            const p = lifted(sample);
            if (!p.on) {
              pen = false;
              continue;
            }
            if (pen) g.lineTo(p.x, p.y);
            else g.moveTo(p.x, p.y);
            pen = true;
          }
        }
        g.globalAlpha = world;
        g.strokeStyle = colors.line;
        g.setLineDash([3, 4]);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }

      // The flights' lanes: faint dashed curves, fading in with the map.
      if (map > 0 && routes.length) {
        g.beginPath();
        routes.forEach((_, r) => {
          const l = lane(r);
          g.moveTo(l.a.x, l.a.y);
          g.quadraticCurveTo(l.c.x, l.c.y, l.b.x, l.b.y);
        });
        g.globalAlpha = map;
        g.strokeStyle = colors.line;
        g.setLineDash([3, 4]);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }

      // The terminator: where day meets night now, a dashed hairline on the near side.
      const s = sun;
      let ux = -s.y;
      let uy = s.x;
      const uz = 0;
      const un = Math.hypot(ux, uy) || 1;
      ux /= un;
      uy /= un;
      const vx = s.y * uz - s.z * uy;
      const vy = s.z * ux - s.x * uz;
      const vz = s.x * uy - s.y * ux;
      g.beginPath();
      let pen = false;
      for (let k = 0; k <= 160; k++) {
        const t = (k / 160) * Math.PI * 2;
        const x = ux * Math.cos(t) + vx * Math.sin(t);
        const y = uy * Math.cos(t) + vy * Math.sin(t);
        const zz = uz * Math.cos(t) + vz * Math.sin(t);
        const a = x * cl + y * sl;
        if (sp * zz + cp * a <= 0) {
          pen = false;
          continue;
        }
        const px = cx + R * (y * cl - x * sl);
        const py = cy - R * (cp * zz - sp * a);
        if (pen) g.lineTo(px, py);
        else g.moveTo(px, py);
        pen = true;
      }
      g.globalAlpha = 0.55;
      g.strokeStyle = colors.muted;
      g.setLineDash([2, 4]);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;

      // HTML pins, labels and the cluster callout follow the projection.
      const place = (el: HTMLElement | null, v: { x: number; y: number; z: number }, opacity: number) => {
        if (!el) return;
        const a = v.x * cl + v.y * sl;
        const depth = sp * v.z + cp * a;
        const px = cx + R * (v.y * cl - v.x * sl);
        const py = cy - R * (cp * v.z - sp * a);
        const show = depth > 0.05 && opacity > 0.01 && px > -40 && px < width + 40 && py > -40 && py < height + 40;
        el.style.visibility = show ? "visible" : "hidden";
        if (!show) return;
        el.style.opacity = String(opacity);
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      };
      const labelOpacity = smoothstep(0.6, 0.95, z);
      cities.forEach((v, i) => {
        place(pins[i] ?? null, v, 1);
        place(labels[i] ?? null, v, labelOpacity);
      });
      place(cluster, centroid, 1 - smoothstep(0.04, 0.3, z));
      // The destinations: a dot and a label, on the near side only, fading towards the limb and as the
      // world flights fade.
      dests.forEach((v, i) => {
        const pin = destPins[i];
        const label = destLabels[i];
        if (!pin || !label) return;
        const a = v.x * cl + v.y * sl;
        const depth = sp * v.z + cp * a;
        const opacity = world * smoothstep(0.02, 0.12, depth);
        const px = cx + R * (v.y * cl - v.x * sl);
        const py = cy - R * (cp * v.z - sp * a);
        const show = opacity > 0.01 && px > -60 && px < width + 60 && py > -60 && py < height + 60;
        // The label stays inside the card (the sway can carry one a few px over the edge).
        const { x: ox, y: oy, w, h } = destOffset[i]!;
        const lx = Math.min(width - 2 - w, Math.max(2, px + ox));
        const ly = Math.min(height - 2 - h, Math.max(2, py + oy));
        for (const [el, x, y] of [[pin, px, py], [label, lx, ly]] as const) {
          el.style.visibility = show ? "visible" : "hidden";
          if (!show) continue;
          el.style.opacity = String(opacity);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }
      });
    }

    // The planes, over the base: each along its lane or arc with a short fading trail, and a faint ring at
    // the hub when a domestic flight lands (only while things move). Under reduced motion, still planes
    // in the middle of each lane and arc.
    function drawFlights(g: CanvasRenderingContext2D, map: number, world: number) {
      const planeAt = (p: { x: number; y: number; angle: number }, alpha: number) => {
        const cos = Math.cos(p.angle) * dpr;
        const sin = Math.sin(p.angle) * dpr;
        g.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
        g.globalAlpha = alpha;
        g.lineWidth = 2.5;
        g.strokeStyle = colors.bg;
        g.stroke(plane);
        g.fillStyle = colors.accent;
        g.fill(plane);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      // A world flight at t along its arc (0 at the hub), heading out (dir 1) or back (-1).
      const worldPlane = (arc: (typeof arcs)[number], t: number, dir: number, alpha: number, trail: boolean) => {
        if (trail) {
          g.strokeStyle = colors.accent;
          g.lineWidth = 1.5;
          let prev = lifted(arcPoint(arc, Math.min(1, Math.max(0, t - dir * WORLD_TRAIL))));
          for (let k = 1; k <= TRAIL_STEPS; k++) {
            const next = lifted(arcPoint(arc, Math.min(1, Math.max(0, t - dir * WORLD_TRAIL * (1 - k / TRAIL_STEPS)))));
            if (prev.on && next.on) {
              g.beginPath();
              g.moveTo(prev.x, prev.y);
              g.lineTo(next.x, next.y);
              g.globalAlpha = alpha * 0.75 * (k / TRAIL_STEPS);
              g.stroke();
            }
            prev = next;
          }
        }
        const at = lifted(arcPoint(arc, t));
        if (!at.on) return;
        // Pointed along the projected tangent.
        const ahead = lifted(arcPoint(arc, Math.min(1, Math.max(0, t + dir * 0.01))));
        const behind = lifted(arcPoint(arc, Math.min(1, Math.max(0, t - dir * 0.01))));
        planeAt({ x: at.x, y: at.y, angle: Math.atan2(ahead.y - behind.y, ahead.x - behind.x) }, alpha);
      };
      g.lineJoin = "round";
      if (reduced) {
        if (map > 0) {
          routes.forEach((_, r) => planeAt(along(lane(r), 0.5), map));
        }
        if (world > 0) arcs.forEach((arc) => worldPlane(arc, 0.5, 1, world, false));
        g.globalAlpha = 1;
        return;
      }
      g.lineCap = "round";
      const moving = motionOK();
      if (map > 0) {
        for (const flight of flights) {
          const time = wrap(flightClock - flight.start, cycle);
          const l = lane(flight.route);
          if (moving && !flight.out && time >= flight.duration && time < flight.duration + LANDING_S) {
            const k = (time - flight.duration) / LANDING_S;
            g.beginPath();
            g.arc(l.a.x, l.a.y, 3 + 11 * (1 - (1 - k) ** 2), 0, Math.PI * 2);
            g.globalAlpha = 0.5 * (1 - k) * map;
            g.strokeStyle = colors.accent;
            g.lineWidth = 1;
            g.stroke();
          }
          if (time >= flight.duration) continue;
          const p = time / flight.duration;
          const t = easeInOutSine(p);
          const alpha = smoothstep(0, 0.08, p) * (1 - smoothstep(0.92, 1, p)) * map;
          g.strokeStyle = colors.accent;
          g.lineWidth = 1.5;
          let prev = along(l, Math.max(0, t - TRAIL), flight.out);
          for (let k = 1; k <= TRAIL_STEPS; k++) {
            const next = along(l, Math.max(0, t - TRAIL * (1 - k / TRAIL_STEPS)), flight.out);
            g.beginPath();
            g.moveTo(prev.x, prev.y);
            g.lineTo(next.x, next.y);
            g.globalAlpha = alpha * 0.75 * (k / TRAIL_STEPS);
            g.stroke();
            prev = next;
          }
          planeAt(along(l, t, flight.out), alpha);
        }
      }
      if (world > 0) {
        for (const flight of worldFlights) {
          const time = wrap(worldClock - flight.start, worldCycle);
          if (time >= flight.duration) continue;
          const p = time / flight.duration;
          const e = easeInOutSine(p);
          const alpha = smoothstep(0, 0.06, p) * (1 - smoothstep(0.94, 1, p)) * world;
          worldPlane(arcs[flight.arc]!, flight.out ? e : 1 - e, flight.out ? 1 : -1, alpha, true);
        }
      }
      g.globalAlpha = 1;
      g.lineCap = "butt";
    }

    // Where each destination's label goes, decided from the home view at the sway's two ends and its
    // middle, so the idle sway never swings one from side to side: the first of sixteen places around the
    // dot that stays inside the card and clear of the other labels, the "Lived in" callout, the button
    // and the arcs (where the planes fly). Rerun when the card's size or the fonts change.
    function placeLabels() {
      if (!width || !destLabels.length) return;
      const saved = { ...proj };
      const sizes = destLabels.map((label) => {
        const box = label.firstElementChild as HTMLElement | null;
        return { w: box?.offsetWidth ?? 0, h: box?.offsetHeight ?? 0 };
      });
      const cardBox = card!.getBoundingClientRect();
      const buttonBox = card!.querySelector("button")?.getBoundingClientRect();
      type Box = { x0: number; y0: number; x1: number; y1: number };
      const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      const views = [-SWAY_DEG, 0, SWAY_DEG].map((swing) => {
        setProjection(HOME.lon + swing, HOME.lat, 0);
        const at = (v: { x: number; y: number; z: number }) => {
          const a = v.x * proj.cl + v.y * proj.sl;
          return { ...project(v), depth: proj.sp * v.z + proj.cp * a };
        };
        const marker = project(centroid);
        const obstacles: Box[] = [{ x0: marker.x - 16, y0: marker.y - 16, x1: marker.x + 16, y1: marker.y + 16 }];
        if (calloutText) {
          const x0 = marker.x + calloutText.offsetLeft;
          const y0 = marker.y + calloutText.offsetTop;
          obstacles.push({ x0, y0, x1: x0 + calloutText.offsetWidth, y1: y0 + calloutText.offsetHeight });
        }
        if (buttonBox) {
          obstacles.push({ x0: buttonBox.left - cardBox.left, y0: buttonBox.top - cardBox.top, x1: buttonBox.right - cardBox.left, y1: buttonBox.bottom - cardBox.top });
        }
        const points: number[] = [];
        for (const arc of arcs) {
          for (let k = 0; k <= 120; k++) {
            const p = lifted(arcPoint(arc, k / 120));
            if (p.on) points.push(p.x, p.y);
          }
        }
        const spots = dests.map(at);
        const dots = spots.map((spot) => (spot.depth > 0.02 ? { x0: spot.x - 5, y0: spot.y - 5, x1: spot.x + 5, y1: spot.y + 5 } : null));
        return { obstacles, points, spots, dots, placed: [] as Box[] };
      });
      dests.forEach((_, i) => {
        const { w, h } = sizes[i]!;
        // Right, left, above, below and the four corners, close to the dot and then a little further out
        // (where two arcs crowd a dot near the limb).
        const options = [7, 18].flatMap((G) => {
          const D = G * 0.7;
          return [
            [G, -h / 2], [-G - w, -h / 2], [-w / 2, -G - h], [-w / 2, G],
            [D, -D - h], [-D - w, -D - h], [D, D], [-D - w, D],
          ] as const;
        });
        let best = 0;
        let bestCost = Infinity;
        options.forEach(([ox, oy], o) => {
          let cost = o * 0.5 + (o >= 8 ? 6 : 0);
          for (const view of views) {
            const spot = view.spots[i]!;
            if (spot.depth < 0.1) continue;
            const box = { x0: spot.x + ox, y0: spot.y + oy, x1: spot.x + ox + w, y1: spot.y + oy + h };
            // Over the card's edge: a few px are fine (draw() clamps the label in), more is not.
            const over = Math.max(2 - box.x0, 2 - box.y0, box.x1 - (width - 2), box.y1 - (height - 2), 0);
            cost += over > 8 ? 1000 : over * 1.5;
            for (const other of [...view.obstacles, ...view.placed]) if (overlaps(box, other)) cost += 300;
            view.dots.forEach((dot, j) => {
              if (dot && j !== i && overlaps(box, dot)) cost += 300;
            });
            for (let k = 0; k < view.points.length; k += 2) {
              const x = view.points[k]!;
              const y = view.points[k + 1]!;
              if (x > box.x0 - 3 && x < box.x1 + 3 && y > box.y0 - 3 && y < box.y1 + 3) cost += 2;
            }
          }
          if (cost < bestCost) {
            bestCost = cost;
            best = o;
          }
        });
        const [ox, oy] = options[best]!;
        destOffset[i] = { x: ox, y: oy, w, h };
        for (const view of views) {
          const spot = view.spots[i]!;
          if (spot.depth >= 0.1) view.placed.push({ x0: spot.x + ox, y0: spot.y + oy, x1: spot.x + ox + w, y1: spot.y + oy + h });
        }
      });
      Object.assign(proj, saved);
      dirty = true;
    }

    // Zoomed in, the centre moves west (or east) just enough for every city label to fit in the card.
    function fitZoomCentre() {
      if (!width) return;
      const saved = { ...proj };
      setProjection(ZOOM_CENTRE.lon, ZOOM_CENTRE.lat, 1);
      let lo = Infinity;
      let hi = -Infinity;
      CITIES.forEach((city, i) => {
        const x = project(cities[i]!).x;
        const w = (labels[i]?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
        const [l, r] = city.side === "left" ? [x - 10 - w, x + 6] : [x - 6, x + 10 + w];
        lo = Math.min(lo, l);
        hi = Math.max(hi, r);
      });
      const M = 8;
      const min = M - lo;
      const max = width - M - hi;
      const shift = min <= max ? Math.min(max, Math.max(min, 0)) : (min + max) / 2;
      zoomCentre = { lon: ZOOM_CENTRE.lon - shift / (proj.R * Math.cos(ZOOM_CENTRE.lat * RAD) * RAD), lat: ZOOM_CENTRE.lat };
      Object.assign(proj, saved);
    }

    const requestFrame = () => {
      if (!frame && visible) frame = requestAnimationFrame(tick);
    };

    let drawn = { lon: NaN, lat: NaN, z: NaN };
    let layerFresh = false;
    function tick(now: number) {
      frame = 0;
      const elapsed = lastTime ? Math.min(250, now - lastTime) : 0;
      const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 1 / 60);
      lastTime = now;

      // The automatic zoom-in, once: counted down while the card shows and motion is allowed, at home,
      // untouched.
      if (armed && !autoZoomSpent && motionOK() && !mode && !anim && !drag) {
        autoLeft -= elapsed;
        if (autoLeft <= 0) {
          autoZoomSpent = true;
          setMode(1, false);
        }
      }
      const R = radiusFor(view.z);
      const target = home();
      let busy = false;
      // Keep the centre within half a turn of home, so easing back never unwinds whole turns.
      view.lon = target.lon + ((((view.lon - target.lon) % 360) + 540) % 360) - 180;

      if (anim) {
        const t = Math.min(1, (now - anim.start) / ZOOM_MS);
        const e = easeInOut(t);
        view.lon = anim.from.lon + (anim.to.lon - anim.from.lon) * e;
        view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
        view.z = anim.from.z + (anim.to.z - anim.from.z) * e;
        if (t >= 1) anim = null;
        busy = true;
      } else if (drag) {
        busy = true;
      } else if (Math.hypot(velocity.x, velocity.y) > 8) {
        view.lon -= (velocity.x * dt) / R / RAD;
        view.lat = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, view.lat + (velocity.y * dt) / R / RAD));
        clampToRegion();
        const decay = Math.exp(-dt * 5);
        velocity = { x: velocity.x * decay, y: velocity.y * decay };
        busy = true;
      } else if (motionOK() && (Math.abs(view.lon - target.lon) > 0.002 || Math.abs(view.lat - target.lat) > 0.002)) {
        const since = now - lastInput;
        if (since >= IDLE_MS) {
          const k = 1 - Math.exp(-dt * 2.2);
          view.lon += (target.lon - view.lon) * k;
          view.lat += (target.lat - view.lat) * k;
          busy = true;
        } else if (!wake) {
          wake = window.setTimeout(() => {
            wake = 0;
            requestFrame();
          }, IDLE_MS - since + 16);
        }
      }

      // The sway: only at home, settled, with motion allowed; its weight eases in and out.
      const atHome = Math.abs(view.lon - target.lon) < 0.5 && Math.abs(view.lat - target.lat) < 0.5;
      const swayTarget = motionOK() && !anim && !drag && !mode && atHome && now - lastInput >= IDLE_MS ? 1 : 0;
      // Under the motion pause (or reduced motion) the sway holds where it is.
      if (motionOK()) {
        swayPhase += (dt * 2 * Math.PI) / SWAY_PERIOD_S;
        if (sway !== swayTarget) {
          sway += (swayTarget - sway) * (1 - Math.exp(-dt * 1.2));
          if (Math.abs(sway - swayTarget) < 0.002) sway = swayTarget;
        }
        if (sway > 0) busy = true;
      }

      const lon = view.lon + SWAY_DEG * sway * Math.sin(swayPhase);
      const moved = dirty || lon !== drawn.lon || view.lat !== drawn.lat || view.z !== drawn.z;
      // The domestic flights run while the map shows (zoomed in), the world flights while the globe does;
      // both hold still under the motion pause, and start afresh (planes mid-flight) each time they appear.
      const map = routes.length ? smoothstep(MAP_FROM, MAP_TO, view.z) : 0;
      const world = arcs.length ? 1 - smoothstep(WORLD_FROM, WORLD_TO, view.z) : 0;
      const flying = (map > 0 || world > 0) && motionOK();
      if (map > 0 && flying) flightClock += dt;
      else if (map <= 0) flightClock = flightsRest;
      if (world > 0 && flying) worldClock += dt;
      else if (world <= 0) worldClock = worldRest;
      if (flying) busy = true;
      if (moved) {
        // The view moved: draw it straight to the canvas, the planes on top.
        draw(ctx!, lon, view.lat, view.z);
        layerFresh = false;
        if (map > 0 || world > 0) drawFlights(ctx!, map, world);
      } else if (flying) {
        // Only the planes move: the view, drawn once into the layer, is copied under them each frame.
        if (layerCtx) {
          if (!layerFresh) {
            if (layer.width !== canvas!.width || layer.height !== canvas!.height) {
              layer.width = canvas!.width;
              layer.height = canvas!.height;
            }
            draw(layerCtx, lon, view.lat, view.z);
            layerFresh = true;
          }
          ctx!.setTransform(1, 0, 0, 1, 0, 0);
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx!.drawImage(layer, 0, 0);
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else draw(ctx!, lon, view.lat, view.z);
        drawFlights(ctx!, map, world);
      }
      if (moved) {
        drawn = { lon, lat: view.lat, z: view.z };
        dirty = false;
      }
      if (busy) requestFrame();
      else lastTime = 0;
    }

    const resize = () => {
      const rect = card.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      fitZoomCentre();
      placeLabels();
      if (mode && !anim && !drag && !motionOK()) Object.assign(view, zoomCentre);
      dirty = true;
      requestFrame();
    };

    // A zoom the visitor asked for is announced; the automatic one isn't.
    const setMode = (next: number, announce: boolean) => {
      if (next === mode) return;
      mode = next;
      setZoomed(Boolean(next));
      if (announce) {
        setAnnouncement(
          next
            ? citiesCaption(`Zoomed in on a map of South India's states${FLIGHTS_TEXT}, marking the cities`)
            : `Showing the whole globe${WORLD_TEXT ? `, with ${WORLD_TEXT}` : ""}.`,
        );
      }
      const to = { ...(next ? zoomCentre : HOME), z: next };
      // Fold the sway into the centre, so taking it away doesn't jump.
      view.lon += SWAY_DEG * sway * Math.sin(swayPhase);
      sway = 0;
      velocity = { x: 0, y: 0 };
      lastInput = performance.now();
      if (reduced) {
        Object.assign(view, to);
        anim = null;
      } else anim = { from: { ...view }, to, start: performance.now() };
      dirty = true;
      requestFrame();
    };
    toggleRef.current = () => {
      autoZoomSpent = true;
      setMode(mode ? 0 : 1, true);
    };

    // Drag to turn: horizontal is longitude, vertical latitude (clamped). Touch scrolls vertically.
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, live: false };
      lastInput = performance.now();
      canvas.style.cursor = "grabbing";
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.live) {
        // A drag starts 6px out; on touch only sideways (vertical swipes scroll the page: touch-pan-y).
        if (Math.hypot(dx, dy) < 6 || (event.pointerType === "touch" && Math.abs(dx) < Math.abs(dy))) return;
        autoZoomSpent = true; // the visitor got there first
        view.lon += SWAY_DEG * sway * Math.sin(swayPhase);
        sway = 0;
        anim = null;
        velocity = { x: 0, y: 0 };
        drag.live = true;
      }
      const dt = Math.max(1, event.timeStamp - drag.t) / 1000;
      const R = radiusFor(view.z);
      view.lon -= dx / R / RAD;
      view.lat = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, view.lat + dy / R / RAD));
      clampToRegion();
      // Capped, so a flick turns the globe a little, not halfway round.
      const cap = (v: number) => Math.max(-900, Math.min(900, v));
      velocity = { x: cap(velocity.x * 0.6 + (dx / dt) * 0.4), y: cap(velocity.y * 0.6 + (dy / dt) * 0.4) };
      drag = { ...drag, x: event.clientX, y: event.clientY, t: event.timeStamp };
      lastInput = performance.now();
      requestFrame();
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const tap = !drag.live;
      if (event.timeStamp - drag.t > 80 || reduced || tap || event.type === "pointercancel") velocity = { x: 0, y: 0 };
      drag = null;
      lastInput = performance.now();
      canvas.style.cursor = "";
      if (tap && event.type === "pointerup") {
        const near = Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30;
        if (event.timeStamp - lastTap.t < 320 && near) {
          lastTap = { t: -Infinity, x: 0, y: 0 };
          autoZoomSpent = true;
          setMode(mode ? 0 : 1, true);
        } else lastTap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
      }
      requestFrame();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(card);
    const intersection = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        visible = entry?.isIntersecting ?? false;
        if (entry && entry.intersectionRatio >= 0.5) armed = true;
        if (visible) requestFrame();
        else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
          lastTime = 0;
        }
      },
      { threshold: [0, 0.5] },
    );
    intersection.observe(card);
    const themeObserver = new MutationObserver(() => {
      readColors();
      requestFrame();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
    const onReduced = () => {
      reduced = reducedQuery.matches;
      dirty = true;
      requestFrame();
    };
    reducedQuery.addEventListener("change", onReduced);
    const stopPaused = subscribePaused(() => {
      paused = readPaused();
      requestFrame();
    });
    const clock = window.setInterval(() => {
      sun = sunVector(new Date());
      dirty = true;
      requestFrame();
    }, 60_000);

    readColors();
    resize();
    // Labels are measured: place them again once the web fonts are in.
    document.fonts?.ready.then(() => {
      if (disposed) return;
      fitZoomCentre();
      placeLabels();
      requestFrame();
    });
    // Under reduced motion the globe starts zoomed in, static, with the button offering the whole globe.
    if (reduced) setMode(1, false);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(wake);
      window.clearInterval(clock);
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      reducedQuery.removeEventListener("change", onReduced);
      stopPaused();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.style.cursor = "";
      layer.width = layer.height = 0; // frees the layer's memory
      toggleRef.current = null;
      for (const el of [...pins, ...labels, ...destPins, ...destLabels, cluster]) {
        if (!el) continue;
        el.style.visibility = "";
        el.style.opacity = "";
        el.style.transform = "";
      }
      setZoomed(false);
    };
  }, []);

  return (
    <figure
      ref={root}
      className={cn(
        "chamfer relative aspect-3/4 w-full overflow-hidden bg-bg-elevated [--cut:1rem] lg:[--cut:1.5rem]",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 size-full cursor-grab touch-pan-y select-none"
      />

      {/* Pins, labels and the callout are HTML over the canvas (11px type at any card size), placed from
          the projection each frame; hidden (visibility) until the globe runs and when their point turns away. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [&>*]:invisible [&>*]:absolute [&>*]:top-0 [&>*]:left-0">
        <div data-globe-cluster>
          <span className="absolute size-7 -translate-1/2 rounded-full border border-fg-muted" />
          {/* A short leader straight down to the list, which hangs below the marker over the Indian Ocean,
              where no land dots sit behind the text and no world flights pass (they leave east and north-west). */}
          <span className="absolute top-3.5 left-0 h-4 w-px bg-fg-muted" />
          <span
            data-globe-callout
            className="absolute top-7.5 -right-5 flex flex-col gap-1.5 bg-bg-elevated/80 px-2 py-1.5 whitespace-nowrap [text-shadow:0_0_2px_var(--bg-elevated),0_0_4px_var(--bg-elevated),0_0_8px_var(--bg-elevated)]">
            <span className="eyebrow text-fg-muted">Lived in</span>
            {CITIES.map((city) => (
              <span
                key={city.name}
                className={cn(
                  "font-mono text-[0.6875rem] leading-none font-medium tracking-[0.08em] uppercase",
                  city.now ? "text-accent-ink" : "text-fg",
                )}
              >
                {city.name}
              </span>
            ))}
          </span>
        </div>
        {CITIES.map((city) =>
          city.now ? (
            <div key={city.name} data-globe-pin>
              <PingDot delay={900} className="absolute -translate-1/2" />
            </div>
          ) : (
            <div key={city.name} data-globe-pin>
              <span className="absolute size-1.5 -translate-1/2 rounded-full bg-fg ring-2 ring-bg-elevated" />
            </div>
          ),
        )}
        {DESTINATIONS.map((place) => (
          <div key={place.name} data-globe-dest-pin>
            <span className="absolute size-1.5 -translate-1/2 rounded-full bg-fg-muted ring-2 ring-bg-elevated" />
          </div>
        ))}
        {/* Each destination's label sits where placeLabels finds room, so these start at their dot. */}
        {DESTINATIONS.map((place) => (
          <div key={place.name} data-globe-dest-label>
            <span className="absolute top-0 left-0 bg-bg-elevated/75 px-1.5 py-1 font-mono text-[0.6875rem] leading-none font-medium tracking-[0.08em] whitespace-nowrap text-fg-muted uppercase [text-shadow:0_0_2px_var(--bg-elevated),0_0_4px_var(--bg-elevated),0_0_8px_var(--bg-elevated)]">
              {place.name}
            </span>
          </div>
        ))}
        {CITIES.map((city) => (
          <div key={city.name} data-globe-label>
            <span
              className={cn(
                "absolute flex flex-col gap-1 bg-bg-elevated/75 px-1.5 py-1 whitespace-nowrap [text-shadow:0_0_2px_var(--bg-elevated),0_0_4px_var(--bg-elevated),0_0_8px_var(--bg-elevated)]",
                city.side === "left" && "top-0 right-2.5 -translate-y-1/2 items-end text-right",
                city.side === "right" && "top-0 left-2.5 -translate-y-1/2 items-start",
                city.side === "below" && "top-2 left-1.5 items-start",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[0.6875rem] leading-none font-medium tracking-[0.08em] uppercase",
                  city.now ? "text-accent-ink" : "text-fg",
                )}
              >
                {city.name}
              </span>
              {city.note ? <span className="text-[0.6875rem] leading-none text-fg-muted">{city.note}</span> : null}
            </span>
          </div>
        ))}
      </div>

      {/* Without JavaScript: the list as plain text. */}
      <div aria-hidden className="absolute bottom-4 left-4 flex flex-col gap-1.5 in-data-js:hidden lg:bottom-5 lg:left-5">
        <span className="eyebrow text-fg-muted">Lived in</span>
        {CITIES.map((city) => (
          <span key={city.name} className="font-mono text-[0.6875rem] leading-none tracking-[0.08em] text-fg uppercase">
            {city.note ? `${city.name} · ${city.note}` : city.name}
          </span>
        ))}
      </div>

      {live ? (
        <div className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4">
          <span className="inline-flex chamfer-fill [--cut:0.5rem] [--fill:color-mix(in_oklab,var(--bg-elevated)_85%,transparent)]">
            <button
              type="button"
              onClick={() => toggleRef.current?.()}
              className="eyebrow inline-flex h-11 chamfer-outline items-center gap-2.5 px-4 text-fg-muted transition-colors duration-300 [--cut:0.5rem] hover:text-fg hover:[--outline:var(--fg)] md:h-8 md:px-3.5"
            >
              <span aria-hidden className="font-mono text-[0.8125rem] leading-none">
                {zoomed ? "−" : "+"}
              </span>
              {zoomed ? "Show the whole globe" : "Zoom in on South India"}
            </button>
          </span>
        </div>
      ) : null}

      {/* What the zoom changed, for screen readers: the canvas, pins and labels are hidden from them. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <figcaption className="sr-only">{`${citiesCaption("Globe centred on South India, marking the cities")}${WORLD_TEXT ? ` It also shows ${WORLD_TEXT}.` : ""} Zooming in shows a map of the states${FLIGHTS_TEXT}.`}</figcaption>
    </figure>
  );
}
