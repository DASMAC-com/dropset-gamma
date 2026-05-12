import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import countries from "world-countries";

// 5-color palette (4-color theorem is a guarantee for planar graphs;
// greedy assignment occasionally needs a 5th color and that's fine here).
const PALETTE = ["#5b9bd5", "#ed7d31", "#70ad47", "#ffc000", "#7030a0"];

const idToCca3 = new Map<string, string>();
const adjacency = new Map<string, Set<string>>();
for (const c of countries) {
  // TopoJSON ids in countries-110m are unpadded decimal strings.
  idToCca3.set(String(Number.parseInt(c.ccn3, 10)), c.cca3);
  adjacency.set(c.cca3, new Set(c.borders ?? []));
}

// Greedy graph coloring, Welsh-Powell order (descending degree).
const colorByCca3 = new Map<string, number>();
const sortedByDegree = [...countries].sort(
  (a, b) => (b.borders?.length ?? 0) - (a.borders?.length ?? 0),
);
for (const c of sortedByDegree) {
  const used = new Set<number>();
  for (const n of adjacency.get(c.cca3) ?? []) {
    const ci = colorByCca3.get(n);
    if (ci !== undefined) used.add(ci);
  }
  let pick = 0;
  while (used.has(pick)) pick++;
  colorByCca3.set(c.cca3, pick);
}

// topojson-client typings narrow on the second arg; cast through `any` so the
// GeometryCollection → FeatureCollection overload is selected.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
const topo = topology as any;
// biome-ignore lint/suspicious/noExplicitAny: see comment above
const fc = feature(topo, topo.objects.countries) as any;

export type CountryFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { name: string; cca3: string; fillColor: string };
  id?: string | number;
};

export const WORLD_POLYGONS: CountryFeature[] = (
  fc.features as Array<{
    geometry: GeoJSON.Geometry;
    id?: string | number;
    properties?: { name?: string } | null;
  }>
).map((f) => {
  const id = f.id;
  const cca3 = idToCca3.get(String(id)) ?? "";
  const ci = colorByCca3.get(cca3) ?? 0;
  return {
    type: "Feature",
    geometry: f.geometry,
    id,
    properties: {
      name: f.properties?.name ?? "",
      cca3,
      fillColor: PALETTE[ci % PALETTE.length],
    },
  };
});
