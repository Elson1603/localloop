export type Coordinates = {
  latitude: number;
  longitude: number;
};

const LOCATION_COORDS: Record<string, Coordinates> = {
  koramangala: { latitude: 12.9352, longitude: 77.6245 },
  indiranagar: { latitude: 12.9784, longitude: 77.6408 },
  "hsr layout": { latitude: 12.9116, longitude: 77.6474 },
  "jp nagar": { latitude: 12.9081, longitude: 77.5852 },
  btm: { latitude: 12.9166, longitude: 77.6101 },
  whitefield: { latitude: 12.9698, longitude: 77.75 },
};

const FALLBACK_CITY_CENTER: Coordinates = { latitude: 12.9716, longitude: 77.5946 };

export const USER_COORDS_STORAGE_KEY = "localloop_user_coords";

export const saveUserCoordinates = (coords: Coordinates): void => {
  localStorage.setItem(USER_COORDS_STORAGE_KEY, JSON.stringify(coords));
};

export const getSavedUserCoordinates = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(USER_COORDS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Coordinates>;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
};

export const requestCurrentPosition = (): Promise<Coordinates> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => reject(new Error("Unable to fetch your location. Please allow location access.")),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });

const normalizeLocation = (locationName: string): string => locationName.trim().toLowerCase();

export const getLocationCoordinates = (locationName: string): Coordinates => {
  const normalized = normalizeLocation(locationName);
  const direct = LOCATION_COORDS[normalized];
  if (direct) {
    return direct;
  }

  const fuzzyMatch = Object.entries(LOCATION_COORDS).find(([key]) => normalized.includes(key));
  if (fuzzyMatch) {
    return fuzzyMatch[1];
  }

  return FALLBACK_CITY_CENTER;
};

export const distanceInKm = (from: Coordinates, to: Coordinates): number => {
  const toRadians = (value: number): number => (value * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const latDiff = toRadians(to.latitude - from.latitude);
  const lonDiff = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDiff / 2) * Math.sin(lonDiff / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};
