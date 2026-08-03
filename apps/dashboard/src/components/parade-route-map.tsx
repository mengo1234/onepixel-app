"use client";

import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";

export type RoutePoint = { latitude: number; longitude: number };
export type RouteMapStop = RoutePoint & { id: string; label: string; radiusM?: number; active?: boolean; completed?: boolean };

function AddPoint({ onAdd }: { onAdd?: (point: RoutePoint) => void }) {
  useMapEvents({ click: (event) => onAdd?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }) });
  return null;
}

function FitRoute({ points, fallback }: { points: RoutePoint[]; fallback: RoutePoint }) {
  const map = useMap();
  const fallbackLatitude = fallback.latitude;
  const fallbackLongitude = fallback.longitude;
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]), { padding: [34, 34], maxZoom: 17 });
    } else {
      map.setView([points[0]?.latitude ?? fallbackLatitude, points[0]?.longitude ?? fallbackLongitude], 16, { animate: false });
    }
  }, [fallbackLatitude, fallbackLongitude, map, points]);
  return null;
}

export default function ParadeRouteMap({ center, points, stops = [], onAdd, onSelectStop, selectedStopId, leader }: {
  center: RoutePoint;
  points: RoutePoint[];
  stops?: RouteMapStop[];
  onAdd?: (point: RoutePoint) => void;
  onSelectStop?: (id: string) => void;
  selectedStopId?: string;
  leader?: RoutePoint;
}) {
  const positions = points.map((point) => [point.latitude, point.longitude] as [number, number]);
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={16} zoomControl className="size-full">
      <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <FitRoute points={points} fallback={center} />
      <AddPoint onAdd={onAdd} />
      {positions.length >= 2 && <Polyline positions={positions} pathOptions={{ color: "#d1e66a", weight: 5, opacity: .9, lineCap: "round", lineJoin: "round" }} />}
      {points.map((point, index) => {
        const stop = stops.find((item) => item.latitude === point.latitude && item.longitude === point.longitude);
        const selected = stop?.id === selectedStopId;
        const color = stop?.completed ? "#77a4a1" : stop?.active === false ? "#59615f" : "#d1e66a";
        return <CircleMarker key={`${point.latitude}-${point.longitude}-${index}`} center={[point.latitude, point.longitude]} radius={selected ? 9 : stop ? 7 : 5} eventHandlers={stop && onSelectStop ? { click: () => onSelectStop(stop.id) } : undefined} pathOptions={{ color: "#0b0d0e", fillColor: color, fillOpacity: 1, weight: selected ? 3 : 2 }}><Tooltip direction="top">{stop?.label ?? `Punto ${index + 1}`}</Tooltip></CircleMarker>;
      })}
      {stops.filter((stop) => stop.radiusM).map((stop) => <Circle key={`radius-${stop.id}`} center={[stop.latitude, stop.longitude]} radius={stop.radiusM} pathOptions={{ color: stop.completed ? "#77a4a1" : "#d1e66a", fillColor: stop.completed ? "#77a4a1" : "#d1e66a", fillOpacity: .07, weight: 1, dashArray: "6 5" }} />)}
      {leader && <CircleMarker center={[leader.latitude, leader.longitude]} radius={8} pathOptions={{ color: "#f2f3ed", fillColor: "#77a4a1", fillOpacity: 1, weight: 3 }}><Tooltip direction="top">Capofila</Tooltip></CircleMarker>}
    </MapContainer>
  );
}
