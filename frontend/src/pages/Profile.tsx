import { Bell, CircleCheck, LogOut, MessageSquare, ShieldCheck, Store, Tag, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getMyProfile, listChatMessages, listOffers, listProducts } from "@/lib/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type UserProfile = {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  created_at: string;
};

type ApiErrorShape = {
  detail?: string;
};

const parseTokenPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as ApiErrorShape;
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Ignore parse errors and fallback to status text.
  }
  return response.statusText || "Request failed";
};

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeListings, setActiveListings] = useState(0);
  const [chatThreads, setChatThreads] = useState(0);
  const [openOffers, setOpenOffers] = useState(0);
  const [trustScore, setTrustScore] = useState("New");

  const initials = useMemo(() => {
    const source = profile?.display_name || profile?.email || "LocalLoop";
    const words = source.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [profile]);

  useEffect(() => {
    const loadProfile = async () => {
      const accessToken = localStorage.getItem("localloop_access_token");
      const idToken = localStorage.getItem("localloop_id_token");

      if (!accessToken) {
        navigate("/auth", { replace: true });
        return;
      }

      const idPayload = idToken ? parseTokenPayload(idToken) : null;
      const fallbackEmail = typeof idPayload?.email === "string" ? idPayload.email : "";
      const fallbackName = typeof idPayload?.name === "string" ? idPayload.name : "LocalLoop User";

      try {
        const myProfile = await getMyProfile();
        const mergedProfile: UserProfile = {
          user_id: myProfile.user_id,
          email: myProfile.email || fallbackEmail || "-",
          username: myProfile.username || fallbackEmail || "-",
          display_name: myProfile.display_name || fallbackName,
          created_at: myProfile.created_at,
        };

        setProfile(mergedProfile);

        const [products, sentMessages, receivedMessages, offers] = await Promise.all([
          listProducts({ ownerId: mergedProfile.user_id }),
          listChatMessages({ senderUserId: mergedProfile.user_id }),
          listChatMessages({ recipientUserId: mergedProfile.user_id }),
          listOffers({ buyerUserId: mergedProfile.user_id }),
        ]);

        const threadIds = new Set<string>([
          ...sentMessages.map((msg) => msg.chat_id),
          ...receivedMessages.map((msg) => msg.chat_id),
        ]);

        setActiveListings(products.length);
        setChatThreads(threadIds.size);
        setOpenOffers(offers.filter((offer) => offer.status === "pending").length);

        const completedSignals = products.length + offers.length + threadIds.size;
        setTrustScore(completedSignals >= 8 ? "Trusted" : completedSignals >= 3 ? "Growing" : "New");
      } catch (error: unknown) {
        localStorage.removeItem("localloop_access_token");
        localStorage.removeItem("localloop_id_token");
        localStorage.removeItem("localloop_refresh_token");
        toast({
          title: "Session expired",
          description: error instanceof Error ? error.message : "Please login again.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [navigate, toast]);

  const handleLogout = () => {
    localStorage.removeItem("localloop_access_token");
    localStorage.removeItem("localloop_id_token");
    localStorage.removeItem("localloop_refresh_token");
    toast({
      title: "Logged out",
      description: "You have been signed out successfully.",
    });
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <MarketNavbar />
        <PageShell>
          <Card className="glass rounded-2xl p-6">
            <p className="text-muted-foreground">Loading profile...</p>
          </Card>
        </PageShell>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <Card className="glass mb-6 rounded-2xl border-border/70 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-border/70">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                <p className="text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <Button variant="destructive" className="rounded-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Listings</p>
            <p className="mt-2 text-2xl font-semibold">{activeListings}</p>
            <p className="mt-1 text-sm text-muted-foreground">Products you are currently selling</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Chat Threads</p>
            <p className="mt-2 text-2xl font-semibold">{chatThreads}</p>
            <p className="mt-1 text-sm text-muted-foreground">Buyer and seller conversations</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Offers</p>
            <p className="mt-2 text-2xl font-semibold">{openOffers}</p>
            <p className="mt-1 text-sm text-muted-foreground">Negotiations waiting for response</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trust Score</p>
            <p className="mt-2 text-2xl font-semibold">{trustScore}</p>
            <p className="mt-1 text-sm text-muted-foreground">Will improve with successful trades</p>
          </Card>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Account Details</h2>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{profile.username}</p>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="break-all font-medium">{profile.user_id}</p>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Authentication</p>
              <p className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <CircleCheck className="h-4 w-4" /> Cognito session active
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border-border/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Trust and Safety</h2>
            </div>
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-emerald-600" /> Email verified via Cognito</p>
              <p className="flex items-center gap-2"><Store className="h-4 w-4 text-muted-foreground" /> Seller profile and ratings coming with marketplace phase</p>
              <p className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /> Chat moderation logs will be connected to CloudWatch</p>
              <p className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /> Offer history will be stored in DynamoDB</p>
            </div>
          </Card>
        </section>

        <section className="mt-6">
          <Card className="rounded-2xl border-border/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p className="rounded-xl bg-secondary/60 px-3 py-2">Offer updates: Enabled (default)</p>
              <p className="rounded-xl bg-secondary/60 px-3 py-2">New chat messages: Enabled (default)</p>
              <p className="rounded-xl bg-secondary/60 px-3 py-2">Item status changes: Enabled (default)</p>
              <p className="rounded-xl bg-secondary/60 px-3 py-2">Promotional alerts: Disabled (default)</p>
            </div>
          </Card>
        </section>
      </PageShell>
    </div>
  );
};

export default Profile;
