'use client';

import { Location } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, ChevronLeft, MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';

const KY_HIEU_COLORS: Record<string, { bg: string; dot: string }> = {
  'Dịch vụ ăn uống':                          { bg: 'bg-blue-500/10 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
  'Dịch vụ ăn uống và sản xuất thực phẩm':   { bg: 'bg-purple-500/10 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  'Sản xuất thực phẩm':                        { bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

interface SidebarProps {
  filtered: Location[];
  search: string;
  onSearch: (v: string) => void;
  xaPhuong: string | null;
  onXaPhuong: (v: string | null) => void;
  kyHieu: string | null;
  onKyHieu: (v: string | null) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  allXaPhuong: string[];
  allKyHieu: string[];
  clusterIds: number[] | null;
  onClearCluster: () => void;
}

function LocationItem({
  loc,
  selected,
  onSelect,
}: {
  loc: Location;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const color = KY_HIEU_COLORS[loc.ky_hieu_nhom ?? ''];

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [selected]);

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`
        relative px-4 py-3 cursor-pointer transition-all duration-150
        ${selected
          ? 'bg-blue-50 shadow-[inset_3px_0_0_0_#2563eb]'
          : 'hover:bg-muted/40 shadow-[inset_3px_0_0_0_transparent]'}
      `}
    >
      <p className={`text-sm font-medium leading-snug line-clamp-2 ${selected ? 'text-blue-900' : 'text-foreground'}`}>
        {loc.ten_don_vi}
      </p>
      {loc.dia_chi && (
        <p className={`text-xs mt-0.5 truncate ${selected ? 'text-blue-700/70' : 'text-muted-foreground'}`}>{loc.dia_chi}</p>
      )}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {loc.xa_phuong && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
            {loc.xa_phuong}
          </Badge>
        )}
        {loc.ky_hieu_nhom && color && (
          <Badge
            variant="outline"
            className={`text-[10px] py-0 px-1.5 h-4 font-normal border ${color.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${color.dot} mr-1`} />
            {loc.ky_hieu_nhom}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({
  filtered,
  search,
  onSearch,
  xaPhuong,
  onXaPhuong,
  kyHieu,
  onKyHieu,
  selectedId,
  onSelect,
  allXaPhuong,
  allKyHieu,
  clusterIds,
  onClearCluster,
}: SidebarProps) {
  const displayList = clusterIds
    ? filtered.filter((l) => clusterIds.includes(l.stt))
    : filtered;

  const hasFilter = xaPhuong || kyHieu || search;

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Bản đồ cơ sở ATTP
          </h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm tên đơn vị, địa chỉ..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-1.5">
          <Select value={xaPhuong} onValueChange={(v) => onXaPhuong(v)}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue placeholder="Xã/Phường" />
            </SelectTrigger>
            <SelectContent>
              {allXaPhuong.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kyHieu} onValueChange={(v) => onKyHieu(v)}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue placeholder="Ký hiệu nhóm" />
            </SelectTrigger>
            <SelectContent>
              {allKyHieu.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilter && (
          <button
            onClick={() => { onSearch(''); onXaPhuong(null); onKyHieu(null); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" /> Xóa bộ lọc
          </button>
        )}
      </div>

      <Separator />

      {/* Legend */}
      <div className="px-4 py-2 flex flex-col gap-1">
        {Object.entries(KY_HIEU_COLORS).map(([label, { dot }]) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            {label}
          </span>
        ))}
      </div>

      <Separator />

      {/* Cluster bar */}
      {clusterIds && (
        <>
          <div className="px-4 py-2 flex items-center justify-between bg-primary/5">
            <span className="text-xs font-medium text-primary">
              Cụm: {displayList.length} cơ sở
            </span>
            <button
              onClick={onClearCluster}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-3" /> Tất cả
            </button>
          </div>
          <Separator />
        </>
      )}

      {/* Count */}
      <p className="px-4 py-1.5 text-[11px] text-muted-foreground">
        {displayList.length} kết quả
      </p>

      <Separator />

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border/50">
          {displayList.map((loc) => (
            <LocationItem
              key={loc.stt}
              loc={loc}
              selected={selectedId === loc.stt}
              onSelect={() => onSelect(loc.stt)}
            />
          ))}
          {displayList.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
