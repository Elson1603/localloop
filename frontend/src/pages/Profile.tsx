import { useState } from "react";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { ProductCard } from "@/components/localloop/ProductCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { items } from "@/data/mockData";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("listings");

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <Card className="glass mb-6 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="https://i.pravatar.cc/100?img=22" alt="User" />
              <AvatarFallback>LL</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Nandini Rao</h1>
              <p className="text-muted-foreground">LocalLoop member since 2023</p>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-xl bg-secondary p-1">
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="saved">Saved Items</TabsTrigger>
            <TabsTrigger value="history">Chat History</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 3).map((item) => <ProductCard key={item.id} item={item} />)}
          </TabsContent>

          <TabsContent value="saved" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(2, 5).map((item) => <ProductCard key={item.id} item={item} />)}
          </TabsContent>

          <TabsContent value="history" className="mt-5 space-y-3">
            {["Aarav Sharma", "Priya Nair", "Riya Khanna"].map((name) => (
              <Card key={name} className="rounded-xl border-border/70 p-4">
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground">Last message: Interested in quick meetup this evening.</p>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </PageShell>
    </div>
  );
};

export default Profile;
