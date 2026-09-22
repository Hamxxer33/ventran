import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function WelcomeSheet({ children }: { children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-lg rounded-t-xl px-6 pt-8 pb-8"
      >
        <DialogTitle className="sr-only">Welcome to Ventran</DialogTitle>
        <WelcomePanel />
      </SheetContent>
    </Sheet>
  );
}

export function WelcomePanel() {
  const google = GROK_PROVIDERS.find((p) => p.idp === "google");
  const rest = GROK_PROVIDERS.filter((p) => p.idp !== "google");
  return (
    <div>
      <h2 className="text-center text-xl font-semibold tracking-tight">Welcome to Ventran</h2>
      {authEnabled ? (
        <div className="mt-6 space-y-3">
          {google && (
            <Button
              type="button"
              className="h-12 w-full rounded-full text-sm font-semibold"
              onClick={() => signIn(google.providerId, { callbackURL: "/" })}
            >
              <GoogleMark />
              Continue with Google
            </Button>
          )}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
                  Or
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {rest.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-full text-sm font-semibold"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  <XMark />
                  Continue with {p.label}
                </Button>
              ))}
            </>
          )}
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-muted">Sign-in is disabled.</p>
      )}
      <p className="mt-6 text-center text-[11px] text-subtle">
        <Link to="/help" hash="terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>
        <span className="mx-1.5">·</span>
        <Link to="/help" hash="privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        opacity="0.85"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        opacity="0.7"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        opacity="0.55"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M17.2 3H20l-6.16 7.04L21 21h-5.5l-4.3-6.12L6.2 21H3.4l6.6-7.54L3 3h5.6l3.9 5.64L17.2 3Zm-1 16.2h1.54L8 4.7H6.34l9.86 14.5Z" />
    </svg>
  );
}
