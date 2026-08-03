import { describe, expect, it } from "vitest";
import { parseWfsParcels, selectParcel } from "../src/cadastre.js";
import { countVenueSeats, pointInGeometry, zoneAtLocation } from "../src/geometry.js";

describe("geometrie onePixel", () => {
  const geometry = { type: "Polygon" as const, coordinates: [[[9.12, 45.47], [9.13, 45.47], [9.13, 45.48], [9.12, 45.48], [9.12, 45.47]]] };

  it("riconosce punti e macro-aree, inclusi i bordi", () => {
    expect(pointInGeometry(9.125, 45.475, geometry)).toBe(true);
    expect(pointInGeometry(9.12, 45.47, geometry)).toBe(true);
    expect(pointInGeometry(9.15, 45.475, geometry)).toBe(false);
    expect(zoneAtLocation({ visibility: "public", methods: ["fixed_geofence"], discoveryRadiusM: 3000, geoZones: [{ id: "AREA-A", label: "Area A", geometry, dwellSeconds: 8 }] }, 9.125, 45.475)).toBe("AREA-A");
  });

  it("calcola la capienza delle file con correzioni manuali", () => {
    expect(countVenueSeats({ schemaVersion: 2, unit: "m", widthM: 100, heightM: 80, levels: [{ id: "l1", name: "Terra", order: 0 }], elements: [{ id: "s1", kind: "sector", label: "Settore", polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], rows: 10, seatsPerRow: 20, seatOverrides: [{ id: "removed", row: "1", number: "1", x: 1, y: 1, deleted: true }, { id: "added", row: "11", number: "1", x: 2, y: 2 }] }] })).toBe(200);
  });

  it("non duplica gli override di un posto generato e rispetta esclusioni e posti manuali", () => {
    const document = {
      schemaVersion: 2 as const,
      unit: "m" as const,
      widthM: 20,
      heightM: 20,
      levels: [{ id: "L1", name: "Terra", order: 0 }],
      elements: [{
        id: "S1",
        kind: "sector" as const,
        label: "Settore",
        levelId: "L1",
        polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
        rows: 2,
        seatsPerRow: 3,
        seatOverrides: [
          { id: "accessible", row: "1", number: "1", x: 1, y: 1, accessible: true },
          { id: "deleted", row: "1", number: "2", x: 2, y: 1, deleted: true },
          { id: "manual", row: "M", number: "1", x: 11, y: 11 },
        ],
      }],
    };
    expect(countVenueSeats(document)).toBe(6);
  });
});

describe("parser catastale", () => {
  it("estrae geometria WFS e seleziona la particella coerente col clic", () => {
    const xml = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:cp="http://mapserver.gis.umn.edu/mapserver" xmlns:gml="http://www.opengis.net/gml/3.2"><wfs:member><cp:CadastralParcel><cp:LABEL>221</cp:LABEL><cp:NATIONALCADASTRALREFERENCE>IT.AGE.PLA.C573_0110.221</cp:NATIONALCADASTRALREFERENCE><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>45.4700 9.1200 45.4700 9.1300 45.4800 9.1300 45.4800 9.1200 45.4700 9.1200</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></cp:CadastralParcel></wfs:member></wfs:FeatureCollection>`;
    const parcels = parseWfsParcels(xml);
    expect(parcels).toHaveLength(1);
    expect(parcels[0]).toMatchObject({ label: "221", sheet: "110", parcel: "221", municipalityCode: "C573" });
    expect(selectParcel(parcels, { sheet: "110", parcel: "221", municipalityCode: "C573" }, 45.475, 9.125)).toBe(parcels[0]);
  });
});
