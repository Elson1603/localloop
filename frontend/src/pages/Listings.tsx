import { useEffect, useMemo, useState } from "react";
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
import { toMarketplaceItem } from "@/lib/marketplace";

const Listings = () => {
  const [maxPrice, setMaxPrice] = useState(45000);
  const [distance, setDistance] = useState([10]);
  const [category, setCategory] = useState("all");
  const [barterOnly, setBarterOnly] = useState(false);
  const [items, setItems] = useState<MarketplaceItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        const products = await listProducts();
        if (!mounted) {
          return;
        }
        setItems(products.map(toMarketplaceItem));
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
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const byCategory = category === "all" || item.category === category;
        const byPrice = (item.price ?? maxPrice) <= maxPrice;
        const byDistance = item.distanceKm <= distance[0];
        const byBarter = barterOnly ? item.barterAvailable : true;
        return byCategory && byPrice && byDistance && byBarter;
      }),
    [category, maxPrice, distance, barterOnly],
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
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Distance ({distance[0]} km)</Label>
              <Slider value={distance} onValueChange={setDistance} max={15} min={1} step={1} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2">
              <Label htmlFor="barter">Buy / Barter</Label>
              <Switch id="barter" checked={barterOnly} onCheckedChange={setBarterOnly} />
            </div>
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} results near you</p>
          <Badge className="bg-accent/20 text-accent-foreground">Hyperlocal</Badge>
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
