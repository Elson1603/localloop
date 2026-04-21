import { Bell, MapPin, Moon, Plus, Search, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { requestCurrentPosition, saveUserCoordinates } from "@/lib/location";
import { NotificationsMenu } from "@/components/localloop/NotificationsMenu";

const links = [
  { to: "/", label: "Home" },
  { to: "/listings", label: "Browse" },
  { to: "/chat", label: "Chat" },
  { to: "/offers", label: "Offers" },
  { to: "/profile", label: "Profile" },
];

export const MarketNavbar = () => {
  const [dark, setDark] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileInitials, setProfileInitials] = useState("LL");
  const [isLocating, setIsLocating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const protectedPaths = new Set(["/chat", "/offers", "/profile", "/post"]);
  const shouldShowInlinePost = location.pathname !== "/post" && location.pathname !== "/auth";

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  useEffect(() => {
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

    const toInitials = (value?: string): string => {
      if (!value) {
        return "LL";
      }

      const cleaned = value.trim();
      if (!cleaned) {
        return "LL";
      }

      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
      }
      return cleaned.slice(0, 2).toUpperCase();
    };

    const syncAuthState = () => {
      const accessToken = localStorage.getItem("localloop_access_token");
      const idToken = localStorage.getItem("localloop_id_token");
      const authenticated = Boolean(accessToken);

      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setProfileInitials("LL");
        return;
      }

      const payload = idToken ? parseTokenPayload(idToken) : null;
      const name = typeof payload?.name === "string" ? payload.name : undefined;
      const email = typeof payload?.email === "string" ? payload.email : undefined;
      const source = name || email || "LocalLoop";
      setProfileInitials(toInitials(source));
    };

    const onStorage = () => syncAuthState();
    syncAuthState();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [location.pathname]);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setDark(root.classList.contains("dark"));
  };

  const goNearby = async () => {
    if (isLocating) {
      return;
    }

    try {
      setIsLocating(true);
      const coords = await requestCurrentPosition();
      saveUserCoordinates(coords);
      navigate("/listings?nearby=1");
      toast({
        title: "Nearby enabled",
        description: "Showing products closest to your current location.",
      });
    } catch (error: unknown) {
      toast({
        title: "Location unavailable",
        description: error instanceof Error ? error.message : "Please enable location access and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="container flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-soft">L</div>
            <span className="text-brand">LocalLoop</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              (() => {
                const to = !isAuthenticated && protectedPaths.has(link.to)
                  ? `/auth?returnTo=${encodeURIComponent(link.to)}`
                  : link.to;

                return (
              <NavLink
                key={link.to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition-smooth ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70"
                  }`
                }
              >
                {link.label}
              </NavLink>
                );
              })()
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center gap-2 md:max-w-xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-full pl-9" placeholder="Search nearby items" />
          </div>
          <Button variant="secondary" className="rounded-full" onClick={() => void goNearby()} disabled={isLocating}>
            <MapPin className="mr-2 h-4 w-4" /> {isLocating ? "Locating..." : "Nearby"}
          </Button>
          {shouldShowInlinePost ? (
            <Button asChild className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to={isAuthenticated ? "/post" : `/auth?returnTo=${encodeURIComponent("/post")}`}>
                <Plus className="mr-2 h-4 w-4" /> Post Item
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAuthenticated ? (
            <NotificationsMenu />
          ) : (
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {isAuthenticated ? (
            <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Open profile">
              <Link to="/profile">
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarFallback className="text-xs font-semibold">{profileInitials}</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="icon" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 sm:hidden" aria-label="Login">
                <Link to="/auth">
                  <User className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild className="hidden rounded-full bg-accent text-accent-foreground hover:bg-accent/90 sm:inline-flex">
                <Link to="/auth">Login</Link>
              </Button>
            </>
          )}
        </div>
      </div>

    </header>
  );
};
