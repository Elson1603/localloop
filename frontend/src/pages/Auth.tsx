import { Github, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Auth = () => (
  <div className="grid min-h-screen bg-background lg:grid-cols-2">
    <section className="relative hidden overflow-hidden border-r border-border/70 bg-secondary lg:flex lg:items-center lg:justify-center">
      <div className="absolute -left-8 top-10 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute -bottom-10 right-10 h-52 w-52 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative max-w-md space-y-4 p-8">
        <h1 className="text-4xl font-bold">Welcome to LocalLoop</h1>
        <p className="text-muted-foreground">Join your neighborhood marketplace where everything is closer, faster, and smarter.</p>
        <div className="glass rounded-2xl p-4 text-sm">
          Discover deals • Barter instantly • Chat securely
        </div>
      </div>
    </section>

    <section className="flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-2xl border-border/70 p-6 shadow-card">
        <p className="text-sm text-muted-foreground">Get started</p>
        <h2 className="mt-1 text-3xl font-bold">Login / Signup</h2>

        <form className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full rounded-full bg-primary py-6 text-primary-foreground hover:bg-primary/90">Continue</Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <Button variant="secondary" className="w-full rounded-full">
            <Mail className="mr-2 h-4 w-4" /> Continue with Google
          </Button>
          <Button variant="secondary" className="w-full rounded-full">
            <Github className="mr-2 h-4 w-4" /> Continue with GitHub
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Back to marketplace? <Link to="/" className="font-medium text-primary">Go Home</Link>
        </p>
      </Card>
    </section>
  </div>
);

export default Auth;
