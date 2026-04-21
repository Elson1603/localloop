import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { ProductCard } from "@/components/localloop/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { MarketplaceItem } from "@/data/mockData";
import { categories } from "@/data/mockData";
import { listProducts } from "@/lib/api";
import { distanceInKm, getLocationCoordinates, getSavedUserCoordinates, type Coordinates } from "@/lib/location";
import { toMarketplaceItem } from "@/lib/marketplace";

const DEFAULT_DISTANCE_KM = 10;

const normalizeCategory = (value: string): string => value.trim().toLowerCase();

const getCategoryFromSearch = (search: string): string => {
  const requestedCategory = new URLSearchParams(search).get("category");
  if (!requestedCategory) {
    return "all";
  }
  return requestedCategory.trim();
};

const Listings = () => {
  const location = useLocation();
  const [maxPrice, setMaxPrice] = useState(45000);
  const [distance, setDistance] = useState([DEFAULT_DISTANCE_KM]);
  const [distanceFilterActive, setDistanceFilterActive] = useState(false);
  const [category, setCategory] = useState(() => getCategoryFromSearch(location.search));
  const [barterOnly, setBarterOnly] = useState(false);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(() => categories.map((cat) => cat.name));
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    setUserCoords(getSavedUserCoordinates());
  }, [location.search]);

  useEffect(() => {
    setCategory(getCategoryFromSearch(location.search));
  }, [location.search]);

  const nearbyRequested = useMemo(() => new URLSearchParams(location.search).get("nearby") === "1", [location.search]);

  useEffect(() => {
    if (nearbyRequested) {
      setDistance([8]);
      setDistanceFilterActive(true);
    } else {
      setDistance([DEFAULT_DISTANCE_KM]);
      setDistanceFilterActive(false);
    }
  }, [nearbyRequested]);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        const products = await listProducts();
        if (!mounted) {
          return;
        }

        const dynamicCategories = Array.from(
          new Set(
            products
              .map((product) => product.category?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        );
        const mergedCategories = Array.from(new Set([...categories.map((cat) => cat.name), ...dynamicCategories]));
        setAvailableCategories(mergedCategories);

        const mapped = products.map(toMarketplaceItem);
        if (!userCoords) {
          setItems(mapped);
          return;
        }

        const withDistances = mapped.map((item, index) => {
          const source = products[index];
          const itemCoords =
            typeof source?.latitude === "number" && typeof source?.longitude === "number"
              ? { latitude: source.latitude, longitude: source.longitude }
              : getLocationCoordinates(item.location);
          const computedDistance = distanceInKm(userCoords, itemCoords);
          return {
            ...item,
            distanceKm: Number(computedDistance.toFixed(1)),
          };
        });
        setItems(withDistances);
      } catch {
        if (!mounted) {
          return;
        }
        setItems([]);
      }
    };

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [userCoords]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const byCategory = category === "all" || normalizeCategory(item.category) === normalizeCategory(category);
        const byPrice = (item.price ?? maxPrice) <= maxPrice;
        const byDistance = !distanceFilterActive || item.distanceKm <= distance[0];
        const byBarter = barterOnly ? item.barterAvailable : true;
        return byCategory && byPrice && byDistance && byBarter;
      }).sort((first, second) => first.distanceKm - second.distanceKm),
    [category, maxPrice, distance, distanceFilterActive, barterOnly, items],
  );

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <h1 className="mb-6 text-3xl font-bold">Product Listings</h1>

        <section className="glass rounded-2xl p-5">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Price range</Label>
              <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableCategories.map((categoryName) => (
                    <SelectItem key={categoryName} value={categoryName}>
                      {categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Distance ({distance[0]} km)</Label>
              <Slider
                value={distance}
                onValueChange={(nextValue) => {
                  setDistance(nextValue);
                  setDistanceFilterActive(true);
                }}
                max={20}
                min={1}
                step={1}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2">
              <Label htmlFor="barter">Buy / Barter</Label>
              <Switch id="barter" checked={barterOnly} onCheckedChange={setBarterOnly} />
            </div>
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} {distanceFilterActive ? "results near you" : "results"}</p>
          <Badge className="bg-accent/20 text-accent-foreground">{userCoords ? "Nearby mode on" : "Hyperlocal"}</Badge>
        </div>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </section>
      </PageShell>
    </div>
  );
};

export default Listings;
