import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Loader2 } from "lucide-react";

export default function Login() {
  const { user, isLoading, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem("roofroute_remember_me") === "true"
  );
  const [email, setEmail] = useState(
    () => (localStorage.getItem("roofroute_remember_me") === "true"
      ? localStorage.getItem("roofroute_saved_email") ?? ""
      : "")
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bootstrap state
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke("manage-users", { body: { action: "check-setup" } })
      .then(({ data }) => {
        if (data?.needsSetup) setNeedsSetup(true);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
    } else {
      if (rememberMe) {
        localStorage.setItem("roofroute_remember_me", "true");
        localStorage.setItem("roofroute_saved_email", email);
      } else {
        localStorage.removeItem("roofroute_remember_me");
        localStorage.removeItem("roofroute_saved_email");
      }
    }
    setSubmitting(false);
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setSetupSubmitting(true);

    const { data, error: fnError } = await supabase.functions.invoke(
      "manage-users",
      {
        body: {
          action: "bootstrap",
          email: setupEmail,
          password: setupPassword,
          full_name: setupName,
        },
      },
    );

    if (fnError || data?.error) {
      setSetupError(data?.error || fnError?.message || "Setup failed");
      setSetupSubmitting(false);
      return;
    }

    const { error: signInError } = await signIn(setupEmail, setupPassword);
    if (signInError) {
      setSetupError(signInError);
    }
    setSetupSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div
        className="flex h-14 items-center gap-2 px-6"
        style={{ backgroundColor: "#1B4F72" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-white">RoofMind</span>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {showSetup ? (
          <form
            onSubmit={handleBootstrap}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                First-Time Setup
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the initial admin account
              </p>
            </div>

            {setupError && (
              <Alert variant="destructive">
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-name">Full Name</Label>
                <Input
                  id="setup-name"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setupSubmitting}
            >
              {setupSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Admin & Sign In"
              )}
            </Button>

            <button
              type="button"
              onClick={() => setShowSetup(false)}
              className="w-full text-center text-sm text-muted-foreground hover:underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">Sign In</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to continue
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                Remember me
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>

            {needsSetup && (
              <button
                type="button"
                onClick={() => setShowSetup(true)}
                className="w-full text-center text-sm text-muted-foreground hover:underline"
              >
                Set up first admin account
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
