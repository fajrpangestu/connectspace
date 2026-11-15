import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { HttpError, wrap } from '../utils.js';

const router = Router();
router.use(requireAuth);

// Cache sederhana agar tidak membebani layanan geocoding
const cache = new Map(); // "lat,lng" (2 desimal) -> { name, at }
const TTL = 60 * 60 * 1000;

const unique = (parts) => [...new Set(parts.filter(Boolean))].join(', ').slice(0, 100);

// Penyedia 1: OpenStreetMap Nominatim
async function fromNominatim(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: lat.toFixed(2),
    lon: lng.toFixed(2),
    zoom: '10', // tingkat kota/kabupaten
    addressdetails: '1',
    'accept-language': 'id',
  });
  const r = await fetch(url, {
    headers: { 'User-Agent': 'ConnectSpace/1.0 (aplikasi belajar)', Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const a = (await r.json()).address || {};
  return unique([
    a.city || a.town || a.municipality || a.county || a.regency || a.village || a.suburb,
    a.state || a.region || a.province,
  ]);
}

// Penyedia 2 (cadangan): BigDataCloud, gratis tanpa API key
async function fromBigDataCloud(lat, lng) {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.search = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    localityLanguage: 'id',
  });
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return unique([j.city || j.locality, j.principalSubdivision]);
}

const PROVIDERS = [
  ['Nominatim', fromNominatim],
  ['BigDataCloud', fromBigDataCloud],
];

// Koordinat -> nama lokasi tingkat kota
router.get(
  '/reverse',
  wrap(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, 'Koordinat tidak valid');
    }

    // Presisi dibulatkan 2 desimal (~1 km): server tidak pernah memakai titik yang tepat
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return res.json({ location: hit.name });

    let reached = false; // minimal satu penyedia berhasil dihubungi
    for (const [label, provider] of PROVIDERS) {
      try {
        const name = await provider(lat, lng);
        reached = true;
        if (name) {
          if (cache.size > 500) cache.clear();
          cache.set(key, { name, at: Date.now() });
          return res.json({ location: name });
        }
      } catch (err) {
        // Terlihat di terminal backend untuk membantu diagnosis
        console.error(`[geo] ${label} gagal:`, err.cause?.code || err.message);
      }
    }

    if (!reached) throw new HttpError(502, 'Layanan lokasi tidak dapat dihubungi');
    res.json({ location: null });
  })
);

export default router;