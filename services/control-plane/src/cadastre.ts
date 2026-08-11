import type { CadastralSource, GeoPolygon } from "../../../packages/protocol/src/index.js";
import { pointInGeometry } from "./geometry.js";

const AJAX_URL = "https://wms.cartografia.agenziaentrate.gov.it/inspire/ajax/ajax.php";
const WFS_URL = "https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php";
const inspirePattern = /IT\.AGE\.PLA\.([A-Z]\d{3})_(\d{4}[A-Z]?\d?)\.([A-Z0-9]+)/i;
const compactPattern = /\b([A-Z]\d{3})([A-Z]?)(\d{4})(?:\d{0,2})?\.([A-Z0-9]+)\b/i;

export type CadastralParcel = {
  label: string;
  sheet?: string;
  parcel?: string;
  municipalityCode?: string;
  inspireId?: string;
  geometry: GeoPolygon;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[\s_./\\-]+/g, "").replace(/^0+/, "") || "0";
}

function parseReference(value: string): Partial<CadastralParcel> {
  const inspire = inspirePattern.exec(value);
  if (inspire) return { municipalityCode: inspire[1].toUpperCase(), sheet: normalize(inspire[2]), parcel: inspire[3].toUpperCase(), inspireId: inspire[0] };
  const compact = compactPattern.exec(value);
  if (compact) return { municipalityCode: compact[1].toUpperCase(), sheet: normalize(compact[3]), parcel: compact[4].toUpperCase(), inspireId: compact[0] };
  return {};
}

function xmlText(block: string, names: string[]): string {
  for (const name of names) {
    const match = new RegExp(`<[^>]*:?${name}[^>]*>([^<]*)<\\/[^>]*:?${name}>`, "i").exec(block);
    if (match) return match[1].trim();
  }
  return "";
}

export function parseWfsParcels(xml: string): CadastralParcel[] {
  const members = xml.match(/<wfs:member\b[\s\S]*?<\/wfs:member>/gi) ?? [];
  const parcels: CadastralParcel[] = [];
  for (const member of members) {
    const positionText = xmlText(member, ["posList"]);
    if (!positionText) continue;
    const values = positionText.split(/\s+/).map(Number).filter(Number.isFinite);
    const ring: number[][] = [];
    for (let index = 0; index + 1 < values.length; index += 2) ring.push([values[index + 1], values[index]]);
    if (ring.length < 3) continue;
    const label = xmlText(member, ["LABEL", "label"]);
    const reference = xmlText(member, ["NATIONALCADASTRALREFERENCE", "nationalCadastralReference"]);
    parcels.push({ label, geometry: { type: "Polygon", coordinates: [ring] }, ...parseReference(reference) });
  }
  return parcels;
}

export function selectParcel(parcels: CadastralParcel[], details: { sheet?: string; parcel?: string; municipalityCode?: string }, lat: number, lng: number): CadastralParcel | undefined {
  const byIdentifier = parcels.filter((candidate) =>
    (!details.parcel || normalize(candidate.parcel || candidate.label) === normalize(details.parcel)) &&
    (!details.sheet || !candidate.sheet || normalize(candidate.sheet) === normalize(details.sheet)) &&
    (!details.municipalityCode || !candidate.municipalityCode || normalize(candidate.municipalityCode) === normalize(details.municipalityCode)),
  );
  return byIdentifier.find((candidate) => pointInGeometry(lng, lat, candidate.geometry))
    ?? byIdentifier[0]
    ?? parcels.find((candidate) => pointInGeometry(lng, lat, candidate.geometry));
}

export async function lookupCadastre(lat: number, lng: number): Promise<{ source: CadastralSource; selected?: CadastralParcel; neighbors: CadastralParcel[] }> {
  const ajaxUrl = new URL(AJAX_URL);
  ajaxUrl.search = new URLSearchParams({ op: "getDatiOggetto", lon: String(lng), lat: String(lat) }).toString();
  const ajaxResponse = await fetch(ajaxUrl, { headers: { "user-agent": "onePixel/1.0 cadastral lookup" }, signal: AbortSignal.timeout(12_000) });
  if (!ajaxResponse.ok) throw new Error(`CATASTRE_AJAX_${ajaxResponse.status}`);
  const data = await ajaxResponse.json() as Record<string, unknown>;
  const sheet = normalize(data.FOGLIO);
  const parcel = String(data.NUM_PART ?? "").trim();
  if (!data.FOGLIO || !parcel) throw new Error(data.TIPOLOGIA === "STRADA" ? "CATASTRE_ROAD" : "CATASTRE_NOT_FOUND");

  const delta = 0.0003;
  const wfsUrl = new URL(WFS_URL);
  wfsUrl.search = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: "CP:CadastralParcel",
    SRSNAME: "urn:ogc:def:crs:EPSG::6706",
    BBOX: `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`,
    COUNT: "50",
  }).toString();
  const wfsResponse = await fetch(wfsUrl, { headers: { "user-agent": "onePixel/1.0 cadastral lookup" }, signal: AbortSignal.timeout(20_000) });
  if (!wfsResponse.ok) throw new Error(`CATASTRE_WFS_${wfsResponse.status}`);
  const parcels = parseWfsParcels(await wfsResponse.text());
  const details = {
    sheet,
    parcel,
    municipalityCode: String(data.COD_COMUNE ?? ""),
  };
  const selected = selectParcel(parcels, details, lat, lng);
  const source: CadastralSource = {
    source: "Agenzia delle Entrate Ajax + WFS",
    municipalityCode: details.municipalityCode,
    municipalityName: String(data.DENOM ?? ""),
    province: String(data.SIGLA_PROV ?? ""),
    sheet,
    parcel,
    inspireId: selected?.inspireId,
    officialGeometry: selected?.geometry,
    capturedAt: new Date().toISOString(),
  };
  return { source, selected, neighbors: parcels.filter((candidate) => candidate !== selected) };
}
