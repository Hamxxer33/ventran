import { createFileRoute, Link } from "@tanstack/react-router";
import { WelcomePanel } from "@/components/auth/welcome";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-end bg-background px-4 pb-8 text-foreground sm:place-items-center sm:px-6 sm:pb-0">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-[var(--shadow-border-hover)] sm:rounded-lg">
        <WelcomePanel />
        <Link to="/" className="mt-4 block text-center text-sm text-muted underline underline-offset-2">
          Browse without an account
        </Link>
      </div>
    </main>
  );
}
