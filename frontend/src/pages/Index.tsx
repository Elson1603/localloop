import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { ProductCard } from "@/components/localloop/ProductCard";
import { SkeletonGrid } from "@/components/localloop/SkeletonGrid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketplaceItem } from "@/data/mockData";
import { categories } from "@/data/mockData";
import { listProducts } from "@/lib/api";
import { toMarketplaceItem } from "@/lib/marketplace";

const Index = () => {
  const [loading, setLoading] = useState(true);
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
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <section className="glass relative overflow-hidden rounded-2xl p-6 md:p-10">
          <div className="absolute -right-16 -top-16 h-56 w-56 animate-floaty rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full bg-secondary px-4 py-1 text-sm text-muted-foreground">
                <Sparkles className="mr-2 h-4 w-4 text-accent" /> Hyperlocal Smart Marketplace
              </span>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">Buy, Sell or Barter Locally</h1>
              <p className="max-w-xl text-muted-foreground">Discover trusted listings around you in seconds, negotiate directly, and close deals with your neighborhood.</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-primary px-6 py-5 text-primary-foreground hover:bg-primary/90">
                  <Link to="/listings">
                  Explore <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-full px-6 py-5">
                  <Link to="/post">Post Item</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {categories.slice(0, 4).map((category) => (
                <Card key={category.name} className="card-hover rounded-2xl border-border/70 bg-card/80 p-4 text-center">
                  <p className="text-2xl">{category.icon}</p>
                  <p className="mt-2 text-sm font-medium">{category.name}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Nearby Listings</h2>
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link to="/listings">View all</Link>
            </Button>
          </div>
          {loading ? (
            <SkeletonGrid />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 6).map((item) => <ProductCard key={item.id} item={item} />)}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Trending Items</h2>
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {items.slice(0, 8).map((item, index) => (
              <div key={`${item.id}-${index}`} className="min-w-[260px] snap-start md:min-w-[320px]">
                <ProductCard item={item} />
              </div>
            ))}
          </div>
        </section>
      </PageShell>
    </div>
  );
};

export default Index;
