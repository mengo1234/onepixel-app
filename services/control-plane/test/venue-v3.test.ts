import { describe, expect, it } from "vitest";
import { distributeVenueCapacity, generateStadiumVenueDocument, ringSectorPolygon, venuePolygonArea, venueSeatGridForCapacity, type VenueElementGeometry } from "../../../packages/protocol/src/index.js";
import { countVenueSeats } from "../src/geometry.js";

describe("motore geometrico venue v3", () => {
  it("distribuisce la capienza in modo esatto e deterministico", () => {
    expect(distributeVenueCapacity(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(distributeVenueCapacity(31_988, [1, 1.2, 1.4]).reduce((sum, value) => sum + value, 0)).toBe(31_988);
    expect(distributeVenueCapacity(5, [0, 0])).toEqual([3, 2]);
  });

  it("crea una griglia posti che rappresenta esattamente la capienza", () => {
    const grid = venueSeatGridForCapacity(913, 40);
    expect(grid.rows * grid.seatsPerRow - grid.excluded.length).toBe(913);
    expect(new Set(grid.excluded.map((seat) => `${seat.row}-${seat.number}`)).size).toBe(grid.excluded.length);
    expect(venueSeatGridForCapacity(0)).toEqual({ rows: 0, seatsPerRow: 0, excluded: [] });
  });

  it.each(["oval", "circle", "rounded-rectangle"] as const)("genera un settore anulare %s valido", (shape) => {
    const geometry: VenueElementGeometry = {
      type: "ring-sector",
      shape,
      center: { x: 110, y: 85 },
      innerWidthM: 90,
      innerHeightM: 60,
      outerWidthM: 130,
      outerHeightM: 100,
      cornerRadiusM: 16,
      startAngleDeg: -90,
      endAngleDeg: -45,
    };
    const polygon = ringSectorPolygon(geometry);
    expect(polygon.length).toBeGreaterThanOrEqual(16);
    expect(venuePolygonArea(polygon)).toBeGreaterThan(1);
    expect(polygon.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("rifiuta geometrie anulari impossibili", () => {
    const invalid: VenueElementGeometry = { type: "ring-sector", shape: "oval", center: { x: 0, y: 0 }, innerWidthM: 100, innerHeightM: 80, outerWidthM: 90, outerHeightM: 70, startAngleDeg: 0, endAngleDeg: 30 };
    expect(() => ringSectorPolygon(invalid)).toThrow("VENUE_RING_SECTOR_SIZE_INVALID");
  });

  it.each([1, 2, 3, 5])("genera %i anelli concentrici con capienza esatta", (ringCount) => {
    const document = generateStadiumVenueDocument({ shape: "oval", outerWidthM: 205, outerHeightM: 155, fieldWidthM: 105, fieldHeightM: 68, totalCapacity: 31_988, ringCount });
    expect(document.levels).toHaveLength(ringCount);
    expect(countVenueSeats(document)).toBe(31_988);
    expect(document.levels.every((level) => (level.ring?.capacity ?? 0) > 0 && (level.ring?.sectorCount ?? 0) > 0)).toBe(true);
    const widths = document.levels.map((level) => document.elements.find((element) => element.levelId === level.id)?.geometry?.outerWidthM);
    expect(new Set(widths).size).toBe(ringCount);
    expect(document.elements.filter((element) => element.geometry).every((element) => venuePolygonArea(element.polygon) > 1)).toBe(true);
  });

  it("rispetta capienze manuali e settori scelti per ogni anello", () => {
    const document = generateStadiumVenueDocument({
      shape: "rounded-rectangle",
      outerWidthM: 190,
      outerHeightM: 145,
      fieldWidthM: 100,
      fieldHeightM: 64,
      totalCapacity: 24_000,
      ringCount: 3,
      capacityMode: "manual",
      rings: [
        { name: "Inferiore", capacity: 10_000, sectorCount: 12 },
        { name: "Medio", capacity: 8_000, sectorCount: 16 },
        { name: "Superiore", capacity: 6_000, sectorCount: 20 },
      ],
    });
    expect(document.levels.map((level) => level.ring?.capacity)).toEqual([10_000, 8_000, 6_000]);
    expect(document.levels.map((level) => level.ring?.sectorCount)).toEqual([12, 16, 20]);
    expect(countVenueSeats(document)).toBe(24_000);
  });

  it("blocca una distribuzione manuale che non coincide col totale", () => {
    expect(() => generateStadiumVenueDocument({ shape: "circle", outerWidthM: 160, outerHeightM: 160, fieldWidthM: 90, fieldHeightM: 60, totalCapacity: 10_000, ringCount: 2, capacityMode: "manual", rings: [{ capacity: 4_000 }, { capacity: 5_000 }] })).toThrow("VENUE_MANUAL_CAPACITY_MISMATCH");
  });
});
