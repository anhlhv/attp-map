'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Location } from '@/lib/types';
import Sidebar from '@/components/Sidebar';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [xaPhuong, setXaPhuong] = useState<string | null>(null);
  const [kyHieu, setKyHieu] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterIds, setClusterIds] = useState<number[] | null>(null);
  const [fitKey, setFitKey] = useState(0);

  useEffect(() => {
    fetch('/locations.json')
      .then((r) => r.json())
      .then(setLocations);
  }, []);

  // Deduplicate wards by normalized key, keep the most frequent spelling
  const { allXaPhuong, xaPhuongCanonical } = useMemo(() => {
    const freq = new Map<string, Map<string, number>>(); // normKey → {spelling → count}
    for (const loc of locations) {
      const raw = loc.xa_phuong;
      if (!raw) continue;
      const key = normalize(raw);
      if (!freq.has(key)) freq.set(key, new Map());
      freq.get(key)!.set(raw, (freq.get(key)!.get(raw) ?? 0) + 1);
    }
    const canonical = new Map<string, string>(); // normKey → best spelling
    for (const [key, counts] of freq) {
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      canonical.set(key, best);
    }
    const sorted = [...canonical.values()].sort((a, b) => a.localeCompare(b, 'vi'));
    return { allXaPhuong: sorted, xaPhuongCanonical: canonical };
  }, [locations]);

  const allKyHieu = useMemo(
    () =>
      [...new Set(locations.map((l) => l.ky_hieu_nhom).filter(Boolean))]
        .sort((a, b) => a!.localeCompare(b!, 'vi')) as string[],
    [locations]
  );

  const filtered = useMemo(() => {
    const q = normalize(search);
    const xaNorm = xaPhuong ? normalize(xaPhuong) : null;
    return locations.filter((loc) => {
      if (xaNorm && normalize(loc.xa_phuong ?? '') !== xaNorm) return false;
      if (kyHieu && loc.ky_hieu_nhom !== kyHieu) return false;
      if (q) {
        const inName = normalize(loc.ten_don_vi ?? '').includes(q);
        const inAddr = normalize(loc.dia_chi ?? '').includes(q);
        if (!inName && !inAddr) return false;
      }
      return true;
    });
  }, [locations, search, xaPhuong, xaPhuongCanonical, kyHieu]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="w-96 flex-shrink-0 h-full overflow-hidden">
        <Sidebar
          filtered={filtered}
          search={search}
          onSearch={setSearch}
          xaPhuong={xaPhuong}
          onXaPhuong={setXaPhuong}
          kyHieu={kyHieu}
          onKyHieu={setKyHieu}
          selectedId={selectedId}
          onSelect={setSelectedId}
          allXaPhuong={allXaPhuong}
          allKyHieu={allKyHieu}
          clusterIds={clusterIds}
          onClearCluster={() => { setClusterIds(null); setFitKey((k) => k + 1); }}
        />
      </div>
      <div className="flex-1 h-full">
        <MapView
          locations={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClusterClick={setClusterIds}
          fitKey={fitKey}
          xaPhuong={xaPhuong}
        />
      </div>
    </div>
  );
}
