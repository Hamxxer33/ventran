import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/** Session that stays pending through SSR + first client paint to avoid hydration mismatch. */
export function useClientSession() {
  const { user, isPending } = useCurrentUserState();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return { user, isPending: !ready || isPending };
}
