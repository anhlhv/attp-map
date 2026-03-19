/**
 * Geocode all locations using OpenStreetMap Nominatim API.
 * Run: node scripts/geocode.mjs
 * Results saved to public/locations.json with lat/lng filled in.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../public/locations.json');

const locations = JSON.parse(readFileSync(dataPath, 'utf-8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Trích xuất "số nhà + ngõ/đường/phố/khu đô thị/tổ dân phố" từ địa chỉ.
 * e.g. "Số 40 phố Bà Triệu"                        → "Số 40 phố Bà Triệu"
 *      "ngõ 23 phố Đỗ Quang"                       → "ngõ 23 phố Đỗ Quang"
 *      "458 đường Minh Khai"                        → "458 đường Minh Khai"
 *      "khu đô thị Vinhomes Times City, số 458..."  → "khu đô thị Vinhomes Times City"
 *      "tổ dân phố 3, phố Tân Lập"                 → "tổ dân phố 3 phố Tân Lập"
 *      "Km6 đường Bắc Thăng Long"                  → "Km6 đường Bắc Thăng Long"
 */
function extractStreet(dia_chi) {
  if (!dia_chi) return null;
  const patterns = [
    // khu đô thị / khu công nghiệp (có thể có số nhà phía trước)
    /(?:số\s+[\w/-]+[,\s]+)?(?:khu đô thị|khu công nghiệp)\s+[^,]+/i,
    // tổ dân phố + phố/đường tiếp theo
    /tổ dân phố\s+[\w\d]+(?:[,\s]+(?:phố|đường|ngõ)\s+[^,]+)?/i,
    // ngõ/ngách (số) + phố/đường
    /ngõ\s+[\d\w/-]+(?:[,\s]+(?:phố|đường)\s+[^,\d][^,]*)?/i,
    /ngách\s+[\d\w/-]+(?:[,\s]+ngõ\s+[\d\w/-]+)?/i,
    // số nhà + phố/đường/quốc lộ/tỉnh lộ
    /(?:số\s+)?[\w/-]+\s+(?:phố|đường|quốc lộ|tỉnh lộ)\s+[^,\d][^,]*/i,
    // km marker
    /km\s*[\d.]+[^,]*/i,
    // số đứng đầu + đường/phố/ngõ
    /\d+[\w/-]*\s+(?:phố|đường|ngõ)\s+[^,\d][^,]*/i,
  ];
  for (const re of patterns) {
    const m = dia_chi.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

const HANOI_BBOX_NOM = 'viewbox=105.25,20.55,106.02,21.38&bounded=1';
const HANOI_BBOX_PHOTON = 'bbox=105.25,20.55,106.02,21.38'; // lon_min,lat_min,lon_max,lat_max

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=vn&${HANOI_BBOX_NOM}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ndatrace-map/1.0' } });
  const data = await res.json();
  await sleep(1100);
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), query: `[Nominatim] ${q}` };
  return null;
}

async function photon(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&${HANOI_BBOX_PHOTON}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ndatrace-map/1.0' } });
  const data = await res.json();
  const feat = data.features?.[0];
  if (feat) {
    const [lng, lat] = feat.geometry.coordinates;
    return { lat, lng, query: `[Photon] ${q}` };
  }
  return null;
}

async function arcgis(q) {
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates` +
    `?SingleLine=${encodeURIComponent(q)}&countryCode=VNM&f=json&maxLocations=1&outFields=Score`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ndatrace-map/1.0' } });
  const data = await res.json();
  const cand = data.candidates?.[0];
  if (cand && cand.score >= 75) {
    return { lat: cand.location.y, lng: cand.location.x, query: `[ArcGIS] ${q}` };
  }
  return null;
}

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY || '';
async function geoapify(q) {
  if (!GEOAPIFY_KEY) return null;
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=countrycode:vn&bias=rect:105.25,20.55,106.02,21.38&limit=1&apiKey=${GEOAPIFY_KEY}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ndatrace-map/1.0' } });
  const data = await res.json();
  const feat = data.features?.[0];
  if (feat && (feat.properties.confidence ?? 1) >= 0.5) {
    const [lng, lat] = feat.geometry.coordinates;
    return { lat, lng, query: `[Geoapify] ${q}` };
  }
  return null;
}

async function geocode(ten_don_vi, dia_chi, xa_phuong) {
  const street = extractStreet(dia_chi);

  // 1. Nominatim: tên đơn vị + địa chỉ + xã phường + Hà Nội
  if (ten_don_vi && dia_chi && xa_phuong) {
    const r = await nominatim(`${ten_don_vi}, ${dia_chi}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 2. Nominatim: địa chỉ + xã phường + Hà Nội
  if (dia_chi && xa_phuong) {
    const r = await nominatim(`${dia_chi}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 3. Nominatim: số nhà + tên đường/khu + xã phường + Hà Nội
  if (street && xa_phuong) {
    const r = await nominatim(`${street}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 4. Photon: địa chỉ + xã phường + Hà Nội
  if (dia_chi && xa_phuong) {
    const r = await photon(`${dia_chi}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 5. Photon: số nhà + tên đường/khu + xã phường + Hà Nội
  if (street && xa_phuong) {
    const r = await photon(`${street}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 6. ArcGIS: địa chỉ + xã phường + Hà Nội
  if (dia_chi && xa_phuong) {
    const r = await arcgis(`${dia_chi}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 7. ArcGIS: số nhà + tên đường/khu + xã phường + Hà Nội
  if (street && xa_phuong) {
    const r = await arcgis(`${street}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 8. Geoapify: địa chỉ + xã phường + Hà Nội
  if (dia_chi && xa_phuong) {
    const r = await geoapify(`${dia_chi}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 9. Geoapify: số nhà + tên đường/khu + xã phường + Hà Nội
  if (street && xa_phuong) {
    const r = await geoapify(`${street}, ${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: false };
  }

  // 10. Nominatim fallback: xã phường + Hà Nội — đánh dấu geocode lại sau
  if (xa_phuong) {
    const r = await nominatim(`${xa_phuong}, Hà Nội`);
    if (r) return { ...r, needs_regeocode: true };
  }

  return null;
}

let success = 0;
let failed = 0;

for (let i = 0; i < locations.length; i++) {
  const loc = locations[i];
  const result = await geocode(loc.ten_don_vi || '', loc.dia_chi || '', loc.xa_phuong || '');
  if (result) {
    loc.lat = result.lat;
    loc.lng = result.lng;
    loc.needs_regeocode = result.needs_regeocode;
    success++;
    const flag = result.needs_regeocode ? ' ⚠ ward-only' : '';
    console.log(`[${i + 1}/${locations.length}] ✓${flag} ${loc.ten_don_vi}`);
    console.log(`    lat: ${result.lat}, lng: ${result.lng}`);
    console.log(`    query: ${result.query}`);
  } else {
    loc.lat = null;
    loc.lng = null;
    loc.needs_regeocode = true;
    failed++;
    console.log(`[${i + 1}/${locations.length}] ✗ ${loc.ten_don_vi} — no coords`);
  }

  // Save progress every 10 records
  if ((i + 1) % 10 === 0) {
    writeFileSync(dataPath, JSON.stringify(locations, null, 2));
    console.log(`  → Saved progress (${success} ok, ${failed} failed)`);
  }

  // sleep handled inside nominatim()
}

writeFileSync(dataPath, JSON.stringify(locations, null, 2));
console.log(`\nDone! ${success} geocoded, ${failed} failed.`);
