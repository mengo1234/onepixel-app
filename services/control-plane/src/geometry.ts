import type { EventAccessPolicy, GeoGeometry, GeoMultiPolygon, GeoPolygon, VenueDocument, VenueElement } from "../../../packages/protocol/src/index.js";

function onSegment(point: [number, number], start: [number, number], end: [number, number]): boolean {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-10) return false;
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (lengthSquared <= 1e-20) return (x - x1) ** 2 + (y - y1) ** 2 <= 1e-20;
  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < 0) return false;
  return dot <= lengthSquared;
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index] as [number, number];
    const previousPoint = ring[previous] as [number, number];
    if (onSegment(point, previousPoint, currentPoint)) return true;
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    const intersects = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-30) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: [number, number], polygon: GeoPolygon): boolean {
  const [outer, ...holes] = polygon.coordinates;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

export function pointInGeometry(lng: number, lat: number, geometry: GeoGeometry | undefined): boolean {
  if (!geometry || geometry.type === "LineString") return false;
  if (geometry.type === "Polygon") return pointInPolygon([lng, lat], geometry);
  return geometry.coordinates.some((coordinates) => pointInPolygon([lng, lat], { type: "Polygon", coordinates }));
}

export function zoneAtLocation(policy: EventAccessPolicy, lng: number, lat: number): string | undefined {
  return policy.geoZones?.find((zone) => pointInGeometry(lng, lat, zone.geometry))?.id;
}

export function venueElementSeatIds(element: VenueElement): string[] {
  const rows = Math.max(0, element.rows ?? 0);
  const seatsPerRow = Math.max(0, element.seatsPerRow ?? 0);
  const generated = new Set<string>();
  for (let row = 1; row <= rows; row += 1) {
    for (let seat = 1; seat <= seatsPerRow; seat += 1) generated.add(`${row}-${seat}`);
  }

  const activeOverrides = new Set<string>();
  const deletedOverrides = new Set<string>();
  for (const seat of element.seatOverrides ?? []) {
    const key = `${seat.row}-${seat.number}`;
    if (seat.deleted) deletedOverrides.add(key);
    else activeOverrides.add(key);
  }

  const result = new Set<string>();
  for (const key of generated) {
    if (!deletedOverrides.has(key) || activeOverrides.has(key)) result.add(key);
  }
  for (const key of activeOverrides) result.add(key);
  return [...result];
}

export function countVenueSeats(document: VenueDocument): number {
  return document.elements.reduce((total, element) => total + venueElementSeatIds(element).length, 0);
}

export function combinePolygons(polygons: GeoPolygon[]): GeoPolygon | GeoMultiPolygon | undefined {
  if (polygons.length === 0) return undefined;
  if (polygons.length === 1) return polygons[0];
  return { type: "MultiPolygon", coordinates: polygons.map((polygon) => polygon.coordinates) };
}
