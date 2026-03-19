'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '@/lib/types';
import { WARD_COORDS } from '@/lib/ward-coords';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ICON_COLORS: Record<string, string> = {
  'Dịch vụ ăn uống': '#3b82f6',
  'Dịch vụ ăn uống và sản xuất thực phẩm': '#8b5cf6',
  'Sản xuất thực phẩm': '#10b981',
};

function createMarkerIcon(color: string, selected: boolean) {
  const c = selected ? '#ef4444' : color;
  const w = 20, h = 28;
  // Teardrop pin: circle on top, pointed tail at bottom
  const r = 8; // circle radius
  const cx = w / 2, cy = r + 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <filter id="s" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
      <g filter="url(#s)">
        <path d="M${cx},${h - 2} C${cx},${h - 2} ${cx - r},${cy + r * 1.2} ${cx - r},${cy}
                 A${r},${r} 0 1,1 ${cx + r},${cy}
                 C${cx + r},${cy + r * 1.2} ${cx},${h - 2} ${cx},${h - 2}Z"
              fill="${c}" stroke="white" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r * 0.38}" fill="white" opacity="0.9"/>
      </g>
      ${selected ? `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="${c}" opacity="0.2" stroke="${c}" stroke-width="1"/>` : ''}
    </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 1],
    popupAnchor: [0, -h + 2],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count: number = cluster.getChildCount();
  const size = count < 10 ? 32 : count < 100 ? 38 : 44;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:rgba(37,99,235,0.88);
      border:2.5px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:${count < 100 ? 13 : 11}px;
      font-family:Inter,sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ locations, fitKey }: { locations: Location[]; fitKey: number }) {
  const map = useMap();
  const prevKey = useRef(-1);
  const prevCount = useRef(0);
  useEffect(() => {
    const pts = locations.map(getCoords).filter((c): c is [number, number] => c !== null);
    if (pts.length === 0) return;
    const forced = fitKey !== prevKey.current;
    if (forced || pts.length !== prevCount.current) {
      prevKey.current = fitKey;
      prevCount.current = pts.length;
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
    }
  }, [locations, fitKey, map]);
  return null;
}

function FlyToSelected({ locations, selectedId }: { locations: Location[]; selectedId: number | null }) {
  const map = useMap();
  const prevId = useRef<number | null>(null);
  useEffect(() => {
    if (selectedId === null || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const loc = locations.find((l) => l.stt === selectedId);
    if (!loc) return;
    const coords = getCoords(loc);
    if (!coords) return;
    map.flyTo(coords, Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [selectedId, locations, map]);
  return null;
}

export function getCoords(loc: Location): [number, number] | null {
  if (loc.lat !== null && loc.lng !== null) return [loc.lat, loc.lng];
  if (loc.xa_phuong && WARD_COORDS[loc.xa_phuong]) {
    const [lat, lng] = WARD_COORDS[loc.xa_phuong];
    return [lat + (Math.random() - 0.5) * 0.005, lng + (Math.random() - 0.5) * 0.005];
  }
  return null;
}

async function fetchWardBoundary(name: string, signal: AbortSignal): Promise<GeoJSON.GeoJsonObject | null> {
  const prefixes = ['Phường', 'Xã', 'Thị trấn'];
  for (const prefix of prefixes) {
    if (signal.aborted) return null;
    const q = `${prefix} ${name}, Hà Nội`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=3&countrycodes=vn`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ndatrace-map/1.0' }, signal });
    const data = await res.json();
    const match = data.find((d: { class: string; geojson?: GeoJSON.GeoJsonObject }) =>
      d.class === 'boundary' && d.geojson
    );
    if (match) return match.geojson;
  }
  return null;
}

function WardBoundary({ xaPhuong }: { xaPhuong: string | null }) {
  const map = useMap();
  const [geojson, setGeojson] = useState<GeoJSON.GeoJsonObject | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    setGeojson(null);
    if (!xaPhuong) return;
    const controller = new AbortController();
    fetchWardBoundary(xaPhuong, controller.signal)
      .then((g) => { if (!controller.signal.aborted) setGeojson(g); })
      .catch(() => {});
    return () => controller.abort();
  }, [xaPhuong]);

  useEffect(() => {
    if (geojson && layerRef.current) {
      const bounds = layerRef.current.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [geojson, map]);

  if (!geojson) return null;
  return (
    <GeoJSON
      key={xaPhuong}
      ref={layerRef}
      data={geojson}
      style={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.08 }}
    />
  );
}

interface MapViewProps {
  locations: Location[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClusterClick: (ids: number[]) => void;
  fitKey: number;
  xaPhuong: string | null;
}

export default function MapView({ locations, selectedId, onSelect, onClusterClick, fitKey, xaPhuong }: MapViewProps) {
  // Map from leaflet marker instance → location stt
  const markerIndex = useRef<Map<L.Marker, number>>(new Map());

  return (
    <MapContainer center={[21.0285, 105.8542]} zoom={12} className="h-full w-full">
      <TileLayer
        attribution='Tiles &copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        attribution=""
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.85}
      />
      <FitBounds locations={locations} fitKey={fitKey} />
      <FlyToSelected locations={locations} selectedId={selectedId} />
      <WardBoundary xaPhuong={xaPhuong} />
      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={50}
        showCoverageOnHover={false}
        chunkedLoading
        eventHandlers={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clusterclick: (e: any) => {
            const childMarkers: L.Marker[] = e.layer.getAllChildMarkers();
            const ids: number[] = [];
            for (const m of childMarkers) {
              const id = markerIndex.current.get(m);
              if (id !== undefined) ids.push(id);
            }
            if (ids.length > 0) onClusterClick(ids);
            e.layer._map.fitBounds(e.layer.getBounds(), { padding: [60, 60] });
          },
        }}
      >
        {locations.map((loc) => {
          const coords = getCoords(loc);
          if (!coords) return null;
          const color = ICON_COLORS[loc.ky_hieu_nhom ?? ''] ?? '#6b7280';
          return (
            <Marker
              key={loc.stt}
              position={coords}
              icon={createMarkerIcon(color, selectedId === loc.stt)}
              eventHandlers={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                add: (e: any) => markerIndex.current.set(e.target, loc.stt),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                remove: (e: any) => markerIndex.current.delete(e.target),
                click: () => onSelect(loc.stt),
              }}
            >
              <Popup>
                <div className="text-sm space-y-1 min-w-[200px]">
                  <p className="font-semibold leading-snug">{loc.ten_don_vi}</p>
                  <p className="text-gray-600 text-xs">{loc.dia_chi}</p>
                  {loc.xa_phuong && (
                    <p className="text-gray-500 text-xs">Phường/Xã: {loc.xa_phuong}</p>
                  )}
                  {loc.ky_hieu_nhom && (
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-xs text-white"
                      style={{ background: ICON_COLORS[loc.ky_hieu_nhom] ?? '#6b7280' }}
                    >
                      {loc.ky_hieu_nhom}
                    </span>
                  )}
                  <p className="text-gray-500 text-xs">Chủ cơ sở: {loc.chu_co_so}</p>
                  {loc.dien_thoai && (
                    <p className="text-gray-500 text-xs">ĐT: {loc.dien_thoai}</p>
                  )}
                  <p className="text-gray-400 text-xs">Số TC: {loc.so_tc}</p>
                  {loc.ngay_cap && (
                    <p className="text-gray-400 text-xs">Ngày cấp: {loc.ngay_cap}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
