import { MapPin, Repeat2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MarketplaceItem } from "@/data/mockData";

export const ProductCard = ({ item }: { item: MarketplaceItem }) => (
  <Link to={`/listings/${item.id}`} className="block">
    <Card className="card-hover overflow-hidden rounded-2xl border-border/70 bg-card/90">
      <img src={item.image} alt={item.title} className="h-44 w-full object-cover transition-smooth hover:scale-105" loading="lazy" />
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold md:text-base">{item.title}</h3>
          {item.barterAvailable && (
            <Badge className="gap-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15">
              <Repeat2 className="h-3 w-3" /> Barter
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold text-primary">{item.price ? `₹${item.price.toLocaleString()}` : "Barter Available"}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {item.distanceKm} km away
          </span>
          <span>{item.location}</span>
        </div>
      </CardContent>
    </Card>
  </Link>
);
