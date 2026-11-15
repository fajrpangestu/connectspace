import { api } from './api.js';

const OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 };

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject({ code: 0 });
    navigator.geolocation.getCurrentPosition(resolve, reject, OPTIONS);
  });
}

// Pesan yang menjelaskan penyebab kegagalan agar mudah diperbaiki pengguna
export function locationMessage(reason) {
  switch (reason) {
    case 'denied':
      return 'Izin lokasi diblokir browser. Klik ikon lokasi di samping alamat situs, pilih Izinkan, lalu coba lagi.';
    case 'position':
      return 'Perangkat tidak bisa menentukan posisi. Aktifkan Layanan Lokasi di pengaturan Windows/HP.';
    case 'timeout':
      return 'Pencarian lokasi terlalu lama. Coba lagi.';
    case 'unsupported':
      return 'Browser ini tidak mendukung lokasi.';
    case 'service':
      return 'Server gagal mengubah posisi menjadi nama kota. Pastikan backend sudah di-restart dan ada koneksi internet.';
    case 'unknown':
      return 'Nama lokasi untuk posisi Anda tidak ditemukan.';
    default:
      return 'Lokasi tidak dapat ditentukan.';
  }
}

// Deteksi lokasi pengguna lalu ubah menjadi nama kota.
// Tidak pernah melempar error: hasilnya { location, reason }.
export async function detectLocation() {
  let pos;
  try {
    pos = await getPosition();
  } catch (err) {
    const reasons = { 0: 'unsupported', 1: 'denied', 2: 'position', 3: 'timeout' };
    return { location: '', reason: reasons[err?.code] || 'unavailable' };
  }

  try {
    // Koordinat dibulatkan 2 desimal (~1 km) sebelum dikirim ke server
    const lat = Number(pos.coords.latitude.toFixed(2));
    const lng = Number(pos.coords.longitude.toFixed(2));
    const { location } = await api.reverseGeocode(lat, lng);
    return location ? { location } : { location: '', reason: 'unknown' };
  } catch {
    return { location: '', reason: 'service' };
  }
}