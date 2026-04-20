import { Bell, MapPin, Moon, Plus, Search, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const links = [
  { to: "/", label: "Home" },
  { to: "/listings", label: "Browse" },
  { to: "/chat", label: "Chat" },
  { to: "/profile", label: "Profile" },
];

export const MarketNavbar = () => {
  const [dark, setDark] = useState(false);
  const location = useLocation();
  const shouldShowFloatingPost = location.pathname !== "/post" && location.pathname !== "/auth";

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setDark(root.classList.contains("dark"));
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
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition-smooth ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center gap-2 md:max-w-xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-full pl-9" placeholder="Search nearby items" />
          </div>
          <Button variant="secondary" className="rounded-full">
            <MapPin className="mr-2 h-4 w-4" /> Nearby
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button asChild size="icon" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 sm:hidden" aria-label="Login">
            <Link to="/auth">
              <User className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="hidden rounded-full bg-accent text-accent-foreground hover:bg-accent/90 sm:inline-flex">
            <Link to="/auth">Login</Link>
          </Button>
        </div>
      </div>

      {shouldShowFloatingPost && (
        <Button
          asChild
          className="fixed bottom-5 right-5 z-50 rounded-full bg-accent px-5 py-6 text-base font-semibold text-accent-foreground shadow-soft transition-smooth hover:-translate-y-0.5 hover:bg-accent/90 md:bottom-6 md:right-6"
        >
          <Link to="/post">
            <Plus className="mr-2 h-4 w-4" /> Post Item
          </Link>
        </Button>
      )}
    </header>
  );
};
