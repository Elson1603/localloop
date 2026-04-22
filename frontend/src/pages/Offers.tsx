import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  getMyProfile,
  getProduct,
  listOffers,
  listProducts,
  updateOfferStatus,
  type Offer,
  type OfferStatus,
  type Product,
} from "@/lib/api";

type OfferFilter = "all" | "pending" | "accepted" | "rejected";
type OfferView = "incoming" | "outgoing";

const filterOptions: OfferFilter[] = ["all", "pending", "accepted", "rejected"];

const badgeClassByStatus: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const Offers = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [incomingOffers, setIncomingOffers] = useState<Offer[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<Offer[]>([]);
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [activeFilter, setActiveFilter] = useState<OfferFilter>("all");
  const [activeView, setActiveView] = useState<OfferView>("incoming");
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  const loadOffers = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const profile = await getMyProfile();
      const ownedProducts = await listProducts({ ownerId: profile.user_id });
      const incomingByProduct = await Promise.all(ownedProducts.map((product) => listOffers({ productId: product.product_id })));
      const nextIncomingOffers = incomingByProduct.flat().sort((first, second) => second.created_at.localeCompare(first.created_at));

      const nextOutgoingOffers = (await listOffers({ buyerUserId: profile.user_id }))
        .sort((first, second) => second.created_at.localeCompare(first.created_at));

      const initialProductLookup = Object.fromEntries(ownedProducts.map((product) => [product.product_id, product]));
      const missingProductIds = Array.from(
        new Set(
          nextOutgoingOffers
            .map((offer) => offer.product_id)
            .filter((productId) => Boolean(productId) && !initialProductLookup[productId]),
        ),
      );

      const fetchedProducts = await Promise.all(
        missingProductIds.map(async (productId) => {
          try {
            return await getProduct(productId);
          } catch {
            return null;
          }
        }),
      );

      const mergedLookup = { ...initialProductLookup };
      fetchedProducts.forEach((product) => {
        if (product) {
          mergedLookup[product.product_id] = product;
        }
      });

      setProductsById(mergedLookup);
      setIncomingOffers(nextIncomingOffers);
      setOutgoingOffers(nextOutgoingOffers);
    } catch (error: unknown) {
      setIncomingOffers([]);
      setOutgoingOffers([]);
      toast({
        title: "Unable to load offers",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOffers();
  }, []);

  const activeOffers = useMemo(() => (
    activeView === "incoming" ? incomingOffers : outgoingOffers
  ), [activeView, incomingOffers, outgoingOffers]);

  const filteredOffers = useMemo(() => {
    if (activeFilter === "all") {
      return activeOffers;
    }
    return activeOffers.filter((offer) => offer.status === activeFilter);
  }, [activeFilter, activeOffers]);

  const stats = useMemo(() => {
    const allOffers = activeOffers;
    return {
      all: allOffers.length,
      pending: allOffers.filter((offer) => offer.status === "pending").length,
      accepted: allOffers.filter((offer) => offer.status === "accepted").length,
      rejected: allOffers.filter((offer) => offer.status === "rejected").length,
    };
  }, [activeOffers]);

  const handleOfferStatusUpdate = async (offerId: string, nextStatus: OfferStatus) => {
    try {
      setUpdatingOfferId(offerId);
      const updatedOffer = await updateOfferStatus({ offerId, status: nextStatus });
      setIncomingOffers((prev) => prev.map((offer) => (offer.offer_id === offerId ? updatedOffer : offer)));
      toast({
        title: `Offer ${nextStatus}`,
        description: `The selected offer was marked as ${nextStatus}.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Unable to update offer",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingOfferId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Offers</h1>
            <p className="text-muted-foreground">Track negotiations you received as a seller and the offers you placed as a buyer.</p>
          </div>
          <Button variant="secondary" onClick={() => void loadOffers(true)} disabled={isLoading || isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <section className="mb-5 flex flex-wrap gap-2">
          <Button variant={activeView === "incoming" ? "default" : "secondary"} onClick={() => setActiveView("incoming")}>
            Incoming
          </Button>
          <Button variant={activeView === "outgoing" ? "default" : "secondary"} onClick={() => setActiveView("outgoing")}>
            Sent
          </Button>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">All Offers</p>
            <p className="mt-1 text-2xl font-semibold">{stats.all}</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold">{stats.pending}</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Accepted</p>
            <p className="mt-1 text-2xl font-semibold">{stats.accepted}</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
            <p className="mt-1 text-2xl font-semibold">{stats.rejected}</p>
          </Card>
        </section>

        <section className="mb-5 flex flex-wrap gap-2">
          {filterOptions.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={activeFilter === filter ? "default" : "secondary"}
              onClick={() => setActiveFilter(filter)}
              className="capitalize"
            >
              {filter}
            </Button>
          ))}
        </section>

        {isLoading ? (
          <Card className="rounded-2xl border-border/70 p-5">
            <p className="text-muted-foreground">Loading offers...</p>
          </Card>
        ) : filteredOffers.length === 0 ? (
          <Card className="rounded-2xl border-border/70 p-5">
            <p className="font-medium">No offers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeView === "incoming"
                ? "Incoming offers will appear here when buyers place offers on your listings."
                : "Offers you send from product pages will appear here."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const product = productsById[offer.product_id];
              const statusClass = badgeClassByStatus[offer.status] || "bg-secondary text-secondary-foreground";

              return (
                <Card key={offer.offer_id} className="rounded-2xl border-border/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-semibold">{product?.title || "Unknown listing"}</p>
                      <Link to={`/listings/${encodeURIComponent(offer.product_id)}`} className="text-sm text-primary hover:underline">
                        Open listing
                      </Link>
                    </div>
                    <Badge className={`w-fit capitalize ${statusClass}`}>{offer.status}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <p><span className="text-muted-foreground">Offered price:</span> ₹{offer.offered_price.toLocaleString()}</p>
                    <p>
                      <span className="text-muted-foreground">{activeView === "incoming" ? "Buyer" : "Seller"}:</span>{" "}
                      {activeView === "incoming" ? offer.buyer_user_id : product?.owner_id || "Unknown"}
                    </p>
                    <p><span className="text-muted-foreground">Created:</span> {new Date(offer.created_at).toLocaleString()}</p>
                    <p><span className="text-muted-foreground">Updated:</span> {new Date(offer.updated_at).toLocaleString()}</p>
                  </div>

                  {offer.note ? <p className="mt-2 text-sm text-muted-foreground">{offer.note}</p> : null}

                  {activeView === "incoming" && offer.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleOfferStatusUpdate(offer.offer_id, "accepted")}
                        disabled={updatingOfferId === offer.offer_id}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleOfferStatusUpdate(offer.offer_id, "rejected")}
                        disabled={updatingOfferId === offer.offer_id}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </PageShell>
    </div>
  );
};

export default Offers;
