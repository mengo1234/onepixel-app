"use client";

import { CircleMarker, MapContainer, Polygon, TileLayer, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Boundary = { coordinates?: number[][][] };

function ClickHandler({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center, map]);
  return null;
}

function positions(boundary?: Boundary): [number, number][] {
  return (boundary?.coordinates?.[0] ?? []).map((coordinate) => [coordinate[1], coordinate[0]] as [number, number]);
}

export default function LocationMap({ center, boundary, neighbors = [], onPick }: { center: [number, number]; boundary?: Boundary; neighbors?: Boundary[]; onPick: (latitude: number, longitude: number) => void }) {
  return (
    <MapContainer center={center} zoom={17} zoomControl className="size-full">
      <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <Recenter center={center} />
      <ClickHandler onPick={onPick} />
      {neighbors.map((neighbor, index) => <Polygon key={index} positions={positions(neighbor)} pathOptions={{ color: "#82908d", opacity: 0.35, weight: 1, fillOpacity: 0.03 }} />)}
      {boundary && <Polygon positions={positions(boundary)} pathOptions={{ color: "#d1e66a", opacity: 0.95, weight: 3, fillColor: "#d1e66a", fillOpacity: 0.14, dashArray: "8 6" }} />}
      <CircleMarker center={center} radius={5} pathOptions={{ color: "#0b0d0e", fillColor: "#d1e66a", fillOpacity: 1, weight: 2 }} />
    </MapContainer>
  );
}
