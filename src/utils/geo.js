// src/utils/geo.js

// Construye un URL de Google Maps con el base64 embebido como query extra.
// Usamos https://maps.google.com/?q=lat,lon&z=<zoom>&cipher=<base64>
export function buildMapsUrl({
  lat,
  lon,
  b64,
  zoom = 6,
  base = "https://maps.google.com",
  ivHex,           // <-- NUEVO
  rounds,          // <-- NUEVO
} = {}) {
  const q = `${lat},${lon}`;
  let u = `${base}/?q=${encodeURIComponent(q)}&z=${zoom}&cipher=${encodeURIComponent((b64 || '').replace(/\s+/g,''))}`;
  if (ivHex) u += `&iv=${encodeURIComponent(ivHex.replace(/\s+/g,''))}`;
  if (Number.isFinite(rounds)) u += `&r=${rounds}`;
  return u;
}



// Intenta pedir una coordenada aleatoria EN TIERRA a 3geonames.
// Si hay CORS o falla, usamos un fallback de coordenadas reales.
export async function getRandomLandCoords({ timeoutMs = 1500 } = {}) {
  // 1) Intento API
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("https://api.3geonames.org/?randomland=yes", {
      signal: ctrl.signal,
      // NO pongas mode:'no-cors' porque no podrías leer la respuesta.
      // Si el server no tiene CORS, caerá al catch -> fallback.
    });
    clearTimeout(t);

    if (res.ok) {
      const xml = await res.text();
      const latt = /<latt>([^<]+)<\/latt>/i.exec(xml)?.[1];
      const longt = /<longt>([^<]+)<\/longt>/i.exec(xml)?.[1];
      if (latt && longt) {
        const lat = parseFloat(latt);
        const lon = parseFloat(longt);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon, source: "api" };
        }
      }
    }
  } catch (_) {
    // ignoramos; pasamos a fallback
  }

  // 2) Fallback “en tierra” (muestra representativa del mundo)
  const LAND = [
    { lat: 19.4326, lon: -99.1332 }, // CDMX, MX
    { lat: 40.4168, lon: -3.7038 },  // Madrid, ES
    { lat: -34.6037, lon: -58.3816 },// Buenos Aires, AR
    { lat: 4.7110,  lon: -74.0721 }, // Bogotá, CO
    { lat: -12.0464,lon: -77.0428 }, // Lima, PE
    { lat: 37.7749, lon: -122.4194 },// San Francisco, US
    { lat: 51.5074, lon: -0.1278 },  // London, UK
    { lat: 48.8566, lon: 2.3522 },   // Paris, FR
    { lat: 35.6895, lon: 139.6917 }, // Tokyo, JP
    { lat: 22.3964, lon: 114.1095 }, // Hong Kong
    { lat: -33.8688,lon: 151.2093 }, // Sydney, AU
    { lat: 52.5200, lon: 13.4050 },  // Berlin, DE
    { lat: 41.9028, lon: 12.4964 },  // Rome, IT
    { lat: 59.3293, lon: 18.0686 },  // Stockholm, SE
    { lat: -26.2041,lon: 28.0473 },  // Johannesburg, ZA
    { lat: 30.0444, lon: 31.2357 },  // Cairo, EG
    { lat: 13.7563, lon: 100.5018 }, // Bangkok, TH
    { lat: 1.3521,  lon: 103.8198 }, // Singapore
    { lat: 55.7558, lon: 37.6173 },  // Moscow, RU
    { lat: -6.2088, lon: 106.8456 }, // Jakarta, ID
  ];
  const pick = LAND[Math.floor(Math.random() * LAND.length)];
  return { ...pick, source: "fallback" };
}
