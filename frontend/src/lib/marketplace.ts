import type { Product } from "@/lib/api";
import type { MarketplaceItem } from "@/data/mockData";
import { distanceInKm, getLocationCoordinates, getSavedUserCoordinates } from "@/lib/location";

const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

const resolveDistanceKm = (product: Product): number => {
  const originCoords = getSavedUserCoordinates() ?? getLocationCoordinates("fallback");
  const productCoords =
    typeof product.latitude === "number" && typeof product.longitude === "number"
      ? { latitude: product.latitude, longitude: product.longitude }
      : getLocationCoordinates(product.location);

  return Number(distanceInKm(originCoords, productCoords).toFixed(1));
};

export const toMarketplaceItem = (product: Product): MarketplaceItem => ({
  id: product.product_id,
  title: product.title,
  category: product.category,
  price: product.price,
  barterAvailable: product.status === "active" || product.status === "reserved",
  distanceKm: resolveDistanceKm(product),
  location: product.location,
  image: product.image_urls[0] || fallbackImage,
  description: product.description,
  status: product.status,
  createdAt: product.created_at,
  seller: {
    name: "Seller",
    rating: 0,
    avatar: "",
  },
});

export const makePlaceholderImage = (seed: string): string => {
  const normalized = encodeURIComponent(seed.trim().toLowerCase() || "localloop-item");
  return `https://picsum.photos/seed/${normalized}/900/700`;
};
