import { MapPin, MessageCircle, Pencil, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { ProductCard } from "@/components/localloop/ProductCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarketplaceItem } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { createOffer, getProduct, getUserProfile, listProducts, type Product } from "@/lib/api";
import { distanceInKm, getLocationCoordinates, getSavedUserCoordinates } from "@/lib/location";
import { toMarketplaceItem } from "@/lib/marketplace";
import { resolveDisplayName, resolveUsernameHandle } from "@/lib/userIdentity";

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
  const [rawProduct, setRawProduct] = useState<Product | null>(null);
  const [product, setProduct] = useState<MarketplaceItem | null>(null);
  const [sellerUserId, setSellerUserId] = useState("");
  const [sellerUsername, setSellerUsername] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [offerPriceInput, setOfferPriceInput] = useState("");
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
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

        let resolvedSellerName = "Seller";
        let resolvedSellerUsername = "";
        try {
          const sellerProfile = await getUserProfile(productData.owner_id || "");
          resolvedSellerName = resolveDisplayName({
            displayName: sellerProfile.display_name,
            username: sellerProfile.username,
            fallback: "Seller",
          });
          resolvedSellerUsername = resolveUsernameHandle(sellerProfile.username);
        } catch {
          // Keep product page usable even when public profile lookup fails.
        }

        if (!mounted) {
          return;
        }

        const mappedProduct = toMarketplaceItem(productData);
        setRawProduct(productData);
        setProduct({
          ...mappedProduct,
          seller: {
            ...mappedProduct.seller,
            name: resolvedSellerName,
          },
        });
        setSellerUserId(productData.owner_id || "");
        setSellerUsername(resolvedSellerUsername);
        setSelectedImage(productData.image_urls[0] || mappedProduct.image);
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
    if (!rawProduct && !product) {
      return [] as string[];
    }
    const uploadedImages = (rawProduct?.image_urls || []).filter(Boolean);
    if (uploadedImages.length > 0) {
      return uploadedImages;
    }
    return product?.image ? [product.image] : [];
  }, [product, rawProduct]);

  useEffect(() => {
    if (!gallery.length) {
      return;
    }
    if (!selectedImage || !gallery.includes(selectedImage)) {
      setSelectedImage(gallery[0]);
    }
  }, [gallery, selectedImage]);

  const mapEmbedUrl = useMemo(() => {
    if (!rawProduct?.location) {
      return "";
    }
    if (typeof rawProduct.latitude === "number" && typeof rawProduct.longitude === "number") {
      const coordsQuery = encodeURIComponent(`${rawProduct.latitude},${rawProduct.longitude}`);
      return `https://maps.google.com/maps?q=${coordsQuery}&z=14&output=embed`;
    }
    const query = encodeURIComponent(`${rawProduct.location}, India`);
    return `https://maps.google.com/maps?q=${query}&z=14&output=embed`;
  }, [rawProduct?.latitude, rawProduct?.longitude, rawProduct?.location]);

  const detailDistanceKm = useMemo(() => {
    if (!rawProduct) {
      return null;
    }

    const userCoords = getSavedUserCoordinates();
    if (!userCoords) {
      return null;
    }

    const productCoords =
      typeof rawProduct.latitude === "number" && typeof rawProduct.longitude === "number"
        ? { latitude: rawProduct.latitude, longitude: rawProduct.longitude }
        : getLocationCoordinates(rawProduct.location);

    return Number(distanceInKm(userCoords, productCoords).toFixed(1));
  }, [rawProduct?.latitude, rawProduct?.longitude, rawProduct?.location]);

  const handleOpenOfferDialog = () => {
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

    const suggestedOffer = Math.max(1, Math.round(product.price * 0.95));
    setOfferPriceInput(String(suggestedOffer));
    setIsOfferDialogOpen(true);
  };

  const handleMakeOffer = async () => {
    if (!product?.price) {
      return;
    }

    const offeredPrice = Number(offerPriceInput);
    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid offer price above 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingOffer(true);
      await createOffer({
        product_id: product.id,
        offered_price: Math.round(offeredPrice),
        note: "Offer sent from product details page",
      });
      toast({
        title: "Offer submitted",
        description: `Your offer of ₹${Math.round(offeredPrice).toLocaleString()} has been sent.`,
      });
      setIsOfferDialogOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Offer failed",
        description: error instanceof Error ? error.message : "Please login and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingOffer(false);
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
  const isOwner = Boolean(isAuthenticated && myUserId && sellerUserId && myUserId === sellerUserId);

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
              <div>
                <p className="font-medium">{product.seller.name}</p>
                <p className="text-sm text-muted-foreground">{sellerUsername ? `@${sellerUsername}` : "Seller profile"}</p>
              </div>
            </Card>

            <Card className="glass rounded-2xl p-4">
              <p className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {product.location}
                {typeof detailDistanceKm === "number" ? ` · ${detailDistanceKm} km away` : ""}
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
              {isOwner ? (
                <Button asChild variant="secondary" className="rounded-full">
                  <Link to={`/post?productId=${encodeURIComponent(product.id)}`}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Listing
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link to={chatPath}>
                      <MessageCircle className="mr-2 h-4 w-4" /> Chat with Seller
                    </Link>
                  </Button>
                  <Button variant="secondary" className="rounded-full" onClick={handleOpenOfferDialog}>
                    <Repeat2 className="mr-2 h-4 w-4" /> Make Offer
                  </Button>
                </>
              )}
            </div>

            <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Make an offer</DialogTitle>
                  <DialogDescription>
                    Listed price: {product.price ? `₹${product.price.toLocaleString()}` : "Barter Available"}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <Label htmlFor="offer-price">Your offer price (₹)</Label>
                  <Input
                    id="offer-price"
                    type="number"
                    min={1}
                    step={1}
                    value={offerPriceInput}
                    onChange={(event) => setOfferPriceInput(event.target.value)}
                    placeholder="Enter your offer"
                  />
                </div>

                <DialogFooter>
                  <Button variant="secondary" onClick={() => setIsOfferDialogOpen(false)} disabled={isSubmittingOffer}>
                    Cancel
                  </Button>
                  <Button onClick={handleMakeOffer} disabled={isSubmittingOffer}>
                    {isSubmittingOffer ? "Sending..." : "Send Offer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
