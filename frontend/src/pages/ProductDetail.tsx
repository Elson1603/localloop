import { MapPin, MessageCircle, Repeat2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { ProductCard } from "@/components/localloop/ProductCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketplaceItem } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { createOffer, getProduct, listProducts } from "@/lib/api";
import { toMarketplaceItem } from "@/lib/marketplace";

const decodeTokenSub = (): string => {
  const token = localStorage.getItem("localloop_id_token");
  if (!token) {
    return "";
  }
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return "";
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const parsed = JSON.parse(decoded) as { sub?: string };
    return parsed.sub || "";
  } catch {
    return "";
  }
};

const ProductDetail = () => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [product, setProduct] = useState<MarketplaceItem | null>(null);
  const [sellerUserId, setSellerUserId] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const isAuthenticated = Boolean(localStorage.getItem("localloop_access_token"));
  const myUserId = decodeTokenSub();

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!id) {
        return;
      }
      try {
        const [productData, allProducts] = await Promise.all([getProduct(id), listProducts()]);
        if (!mounted) {
          return;
        }
        const mappedProduct = toMarketplaceItem(productData);
        setProduct(mappedProduct);
        setSellerUserId(productData.owner_id || "");
        setSelectedImage(mappedProduct.image);
        setItems(allProducts.map(toMarketplaceItem));
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }
        toast({
          title: "Unable to load product",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    };

    void loadData();
    return () => {
      mounted = false;
    };
  }, [id, toast]);

  const gallery = useMemo(() => {
    if (!product) {
      return [] as string[];
    }
    return [product.image, ...items.filter((item) => item.id !== product.id).slice(0, 3).map((item) => item.image)];
  }, [items, product]);

  const mapEmbedUrl = useMemo(() => {
    if (!product?.location) {
      return "";
    }
    const query = encodeURIComponent(`${product.location}, India`);
    return `https://maps.google.com/maps?q=${query}&z=14&output=embed`;
  }, [product?.location]);

  const handleMakeOffer = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please login to make an offer.",
        variant: "destructive",
      });
      navigate(`/auth?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
      return;
    }

    if (!product?.price) {
      return;
    }
    try {
      const offeredPrice = Math.max(1, Math.round(product.price * 0.95));
      await createOffer({
        product_id: product.id,
        offered_price: offeredPrice,
        note: "Offer sent from product details page",
      });
      toast({
        title: "Offer submitted",
        description: `Your offer of Rs ${offeredPrice.toLocaleString()} has been sent.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Offer failed",
        description: error instanceof Error ? error.message : "Please login and try again.",
        variant: "destructive",
      });
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen">
        <MarketNavbar />
        <PageShell>
          <Card className="rounded-2xl border-border/70 p-6">
            <p className="text-muted-foreground">Loading product...</p>
          </Card>
        </PageShell>
      </div>
    );
  }

  const chatPath = isAuthenticated
    ? `/chat?productId=${encodeURIComponent(product.id)}&sellerId=${encodeURIComponent(sellerUserId)}&buyerId=${encodeURIComponent(myUserId)}&sellerName=${encodeURIComponent(product.seller.name)}`
    : `/auth?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-3">
            <img src={selectedImage} alt={product.title} className="h-[340px] w-full rounded-2xl object-cover shadow-card md:h-[470px]" loading="lazy" />
            <div className="grid grid-cols-4 gap-3">
              {gallery.map((image) => (
                <button key={image} onClick={() => setSelectedImage(image)} className="overflow-hidden rounded-xl border border-border/70">
                  <img src={image} alt="Gallery item" className="h-20 w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <p className="text-2xl font-semibold text-primary">{product.price ? `₹${product.price.toLocaleString()}` : "Barter Available"}</p>
            <p className="text-muted-foreground">{product.description}</p>

            <Card className="rounded-2xl border-border/70 p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={product.seller.avatar} alt={product.seller.name} />
                  <AvatarFallback>{product.seller.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{product.seller.name}</p>
                  <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5" /> {product.seller.rating}/5 seller rating
                  </p>
                </div>
              </div>
            </Card>

            <Card className="glass rounded-2xl p-4">
              <p className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {product.location} · {product.distanceKm} km away
              </p>
              {mapEmbedUrl ? (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                  <iframe
                    title={`Map preview for ${product.location}`}
                    src={mapEmbedUrl}
                    className="h-44 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div className="h-44 rounded-xl border border-dashed border-border bg-muted/40" />
              )}
              <p className="mt-2 text-xs text-muted-foreground">Interactive location map preview</p>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to={chatPath}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat with Seller
                </Link>
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={handleMakeOffer}>
                <Repeat2 className="mr-2 h-4 w-4" /> Make Offer
              </Button>
            </div>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Suggested Similar Products</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.filter((item) => item.id !== product.id).slice(0, 3).map((item) => <ProductCard key={item.id} item={item} />)}
          </div>
        </section>
      </PageShell>
    </div>
  );
};

export default ProductDetail;
