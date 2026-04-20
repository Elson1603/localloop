import { FormEvent, useMemo, useState } from "react";
import { Github, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type AuthMode = "login" | "signup";

type ApiErrorShape = {
  detail?: string;
};

type LoginResponse = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as ApiErrorShape;
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Fall through to status text fallback.
  }

  return response.statusText || "Request failed";
};

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");

  const isSignup = mode === "signup";
  const submitLabel = useMemo(() => {
    if (isLoading) {
      return "Please wait...";
    }
    return mode === "login" ? "Login" : "Create account";
  }, [isLoading, mode]);

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !confirmationCode.trim()) {
      toast({
        title: "Missing information",
        description: "Email and confirmation code are required.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/confirm-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          confirmation_code: confirmationCode.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setAwaitingConfirmation(false);
      setConfirmationCode("");
      setMode("login");
      toast({
        title: "Email verified",
        description: "Account confirmed. You can login now.",
      });
    } catch (error: unknown) {
      toast({
        title: "Confirmation failed",
        description: getErrorMessage(error, "Unable to verify confirmation code."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing information",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return;
    }

    if (isSignup) {
      if (!name.trim()) {
        toast({
          title: "Missing information",
          description: "Full name is required for signup.",
          variant: "destructive",
        });
        return;
      }
      if (password !== confirmPassword) {
        toast({
          title: "Password mismatch",
          description: "Confirm password must match password.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isSignup) {
        const signupResponse = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            name: name.trim(),
          }),
        });

        if (!signupResponse.ok) {
          throw new Error(await parseApiError(signupResponse));
        }

        setAwaitingConfirmation(true);
        toast({
          title: "Signup successful",
          description: "Check your email for the confirmation code.",
        });
        return;
      }

      const loginResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error(await parseApiError(loginResponse));
      }

      const tokens = (await loginResponse.json()) as LoginResponse;
      localStorage.setItem("localloop_access_token", tokens.access_token);
      localStorage.setItem("localloop_id_token", tokens.id_token);
      if (tokens.refresh_token) {
        localStorage.setItem("localloop_refresh_token", tokens.refresh_token);
      }

      const meResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!meResponse.ok) {
        throw new Error(await parseApiError(meResponse));
      }

      toast({
        title: "Login successful",
        description: "Welcome back to LocalLoop.",
      });
      navigate("/");
    } catch (error: unknown) {
      toast({
        title: mode === "login" ? "Login failed" : "Signup failed",
        description: getErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setAwaitingConfirmation(false);
    setConfirmationCode("");
  };

  return (
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
        <h2 className="mt-1 text-3xl font-bold">{mode === "login" ? "Login" : "Sign up"}</h2>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
          <Button
            type="button"
            variant={mode === "login" ? "default" : "ghost"}
            className="rounded-lg"
            onClick={() => switchMode("login")}
            disabled={isLoading}
          >
            Login
          </Button>
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "ghost"}
            className="rounded-lg"
            onClick={() => switchMode("signup")}
            disabled={isLoading}
          >
            Sign up
          </Button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isSignup ? (
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isLoading}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
            />
          </div>
          {isSignup ? (
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isLoading}
              />
            </div>
          ) : null}
          <Button
            type="submit"
            className="w-full rounded-full bg-primary py-6 text-primary-foreground hover:bg-primary/90"
            disabled={isLoading}
          >
            {submitLabel}
          </Button>
        </form>

        {awaitingConfirmation ? (
          <form className="mt-4 space-y-3 rounded-xl border border-border/70 p-4" onSubmit={verifyEmail}>
            <p className="text-sm font-medium">Verify your email</p>
            <p className="text-xs text-muted-foreground">
              Enter the code sent to your email to complete signup.
            </p>
            <div className="space-y-2">
              <Label>Confirmation Code</Label>
              <Input
                type="text"
                placeholder="123456"
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
              Verify Email
            </Button>
          </form>
        ) : null}

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
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary"
                onClick={() => switchMode("signup")}
                disabled={isLoading}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary"
                onClick={() => switchMode("login")}
                disabled={isLoading}
              >
                Login
              </button>
            </>
          )}
        </p>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Back to marketplace? <Link to="/" className="font-medium text-primary">Go Home</Link>
        </p>
      </Card>
    </section>
    </div>
  );
};

export default Auth;
