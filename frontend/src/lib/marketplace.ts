import type { Product } from "@/lib/api";
import type { MarketplaceItem } from "@/data/mockData";

const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

export const toMarketplaceItem = (product: Product): MarketplaceItem => ({
  id: product.product_id,
  title: product.title,
  category: product.category,
  price: product.price,
  barterAvailable: true,
  distanceKm: 1,
  location: product.location,
  image: product.image_urls[0] || fallbackImage,
  description: product.description,
  seller: {
    name: "LocalLoop Seller",
    rating: 4.8,
    avatar: "https://i.pravatar.cc/100?img=12",
  },
});

export const makePlaceholderImage = (seed: string): string => {
  const normalized = encodeURIComponent(seed.trim().toLowerCase() || "localloop-item");
  return `https://picsum.photos/seed/${normalized}/900/700`;
};
