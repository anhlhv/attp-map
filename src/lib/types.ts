export interface Location {
  stt: number;
  so_tc: string;
  ten_don_vi: string;
  dia_chi: string;
  xa_phuong: string;
  chu_co_so: string;
  dien_thoai: string;
  nhom_sp: string;
  ky_hieu_nhom: string | null;
  ngay_cap: string;
  lat: number | null;
  lng: number | null;
  needs_regeocode?: boolean;
}
