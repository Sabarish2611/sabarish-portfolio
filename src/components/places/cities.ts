import { education, experience, flightDestinations, livedIn, site } from "@/content/site";

/** Geographic coordinates of the cities, [longitude °E, latitude °N] (public data, not personal facts). */
const COORDINATES: Readonly<Record<string, readonly [number, number]>> = {
  Chennai: [80.2707, 13.0827],
  Bangalore: [77.5946, 12.9716],
  Coimbatore: [76.9558, 11.0168],
  Trichy: [78.7047, 10.7905],
};

/**
 * Which side of its pin each label sits on in the zoomed-in view, so the four never collide. The city
 * Sabarish lives in now, where every flight lane starts and ends, reads below and to the right of its pin,
 * clear of the lanes (which all leave it upwards or to the left).
 */
const LABEL_SIDE: Readonly<Record<string, City["side"]>> = {
  Chennai: "left",
  Bangalore: "left",
  Coimbatore: "left",
  Trichy: "below",
};

/** Where the world flights go (site.ts flightDestinations), [longitude °E, latitude °N] (public data). */
const DESTINATION_COORDINATES: Readonly<Record<string, readonly [number, number]>> = {
  Singapore: [103.8198, 1.3521],
  Auckland: [174.7633, -36.8485],
  Stockholm: [18.0686, 59.3293],
  Brisbane: [153.0251, -27.4698],
  Dubai: [55.2708, 25.2048],
};

/** What the content files say about a city: that Sabarish lives there now, the employer there, or the degree. */
function cityNote(city: string): string | undefined {
  if (city === site.location.city) return "Now";
  const orgs = [...new Set(experience.filter((role) => role.place === city).map((role) => role.org))];
  if (orgs.length) return orgs.join(" · ");
  if (education.city === city) return education.degreeShort.split(",")[0];
  return undefined;
}

export type City = {
  name: string;
  lon: number;
  lat: number;
  note: string | undefined;
  now: boolean;
  /** "below": below and to the right of the pin. */
  side: "left" | "right" | "below";
};

/** The cities Sabarish has lived in (site.ts), in its order, with their coordinates and notes. */
export const CITIES: readonly City[] = livedIn.map((name) => {
  const at = COORDINATES[name];
  if (!at) throw new Error(`Globe: no coordinates for ${name} (add them to src/components/places/cities.ts).`);
  return {
    name,
    lon: at[0],
    lat: at[1],
    note: cityNote(name),
    now: name === site.location.city,
    side: LABEL_SIDE[name] ?? "left",
  };
});

export type Destination = { name: string; lon: number; lat: number };

/** The world flights' destinations (site.ts), in its order, with their coordinates. */
export const DESTINATIONS: readonly Destination[] = flightDestinations.map((name) => {
  const at = DESTINATION_COORDINATES[name];
  if (!at) throw new Error(`Globe: no coordinates for ${name} (add them to src/components/places/cities.ts).`);
  return { name, lon: at[0], lat: at[1] };
});

/** A list in prose: "A, B and C". */
export const listOf = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The figure's text alternative, the map's wording. */
export function citiesCaption(intro: string) {
  return `${intro} ${site.shortName} has lived in: ${CITIES.map((city) =>
    city.note ? `${city.name} (${city.now ? "now" : city.note})` : city.name,
  ).join(", ")}.`;
}
