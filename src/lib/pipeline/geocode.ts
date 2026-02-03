// Geocode country/region names to lat/lng using Mapbox Geocoding API
// Falls back to a static lookup for common countries to save API calls

const COUNTRY_COORDS: Record<string, [number, number]> = {
  "Afghanistan": [69.17, 34.55],
  "Angola": [17.87, -11.20],
  "Argentina": [-58.38, -34.60],
  "Bangladesh": [90.36, 23.68],
  "Brazil": [-47.93, -15.78],
  "Burkina Faso": [-1.52, 12.37],
  "Burundi": [29.92, -3.37],
  "Cambodia": [104.92, 11.56],
  "Cameroon": [11.52, 3.87],
  "Central African Republic": [18.56, 4.39],
  "Chad": [15.04, 12.13],
  "China": [104.20, 35.86],
  "Colombia": [-74.07, 4.71],
  "Comoros": [43.34, -11.70],
  "Democratic Republic of the Congo": [21.76, -4.04],
  "DR Congo": [21.76, -4.04],
  "Djibouti": [43.15, 11.59],
  "Ecuador": [-78.47, -0.18],
  "Egypt": [31.24, 30.04],
  "Ethiopia": [38.75, 9.01],
  "Ghana": [-1.02, 7.95],
  "Guinea": [-13.68, 9.65],
  "Haiti": [-72.29, 18.97],
  "India": [78.96, 20.59],
  "Indonesia": [106.85, -6.21],
  "Iran": [53.69, 32.43],
  "Iraq": [44.37, 33.31],
  "Israel": [34.85, 32.11],
  "Jordan": [35.93, 31.96],
  "Kenya": [36.82, -1.29],
  "Lebanon": [35.50, 33.89],
  "Liberia": [-10.80, 6.43],
  "Libya": [13.18, 32.89],
  "Madagascar": [46.87, -18.77],
  "Malawi": [34.30, -13.97],
  "Mali": [-8.00, 12.64],
  "Mauritania": [-15.98, 18.07],
  "Mexico": [-99.13, 19.43],
  "Morocco": [-7.09, 31.79],
  "Mozambique": [35.53, -25.97],
  "Myanmar": [96.20, 16.87],
  "Nepal": [85.32, 27.72],
  "Niger": [2.11, 13.51],
  "Nigeria": [7.49, 9.06],
  "Pakistan": [67.00, 30.38],
  "Palestine": [34.31, 31.35],
  "Papua New Guinea": [147.18, -6.31],
  "Peru": [-77.04, -12.05],
  "Philippines": [120.98, 14.60],
  "Rwanda": [29.87, -1.94],
  "Saudi Arabia": [45.08, 23.89],
  "Senegal": [-17.47, 14.69],
  "Sierra Leone": [-13.23, 8.48],
  "Somalia": [45.34, 2.05],
  "South Africa": [28.03, -26.20],
  "South Sudan": [31.60, 6.88],
  "Sri Lanka": [80.77, 7.87],
  "Sudan": [32.53, 15.50],
  "Syria": [38.99, 34.80],
  "Tanzania": [34.89, -6.37],
  "Thailand": [100.99, 15.87],
  "Togo": [1.17, 6.17],
  "Uganda": [32.29, 1.37],
  "United States": [-95.71, 37.09],
  "United States of America": [-95.71, 37.09],
  "Venezuela": [-66.90, 10.49],
  "Viet Nam": [108.28, 14.06],
  "Vietnam": [108.28, 14.06],
  "Yemen": [44.21, 15.37],
  "Zambia": [28.28, -15.39],
  "Zimbabwe": [29.15, -19.02],
};

export async function geocodeLocation(
  country: string,
  region: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  // Try static lookup first (saves API calls)
  const staticCoords = COUNTRY_COORDS[country];
  if (staticCoords) {
    return { latitude: staticCoords[1], longitude: staticCoords[0] };
  }

  // Fallback to Mapbox Geocoding API
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn("No Mapbox token for geocoding");
    return null;
  }

  const query = region ? `${region}, ${country}` : country;

  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&types=country,region,place&limit=1`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const feature = data.features?.[0];

    if (feature?.center) {
      return {
        latitude: feature.center[1],
        longitude: feature.center[0],
      };
    }
  } catch (error) {
    console.error(`Geocoding failed for "${query}":`, error);
  }

  return null;
}
