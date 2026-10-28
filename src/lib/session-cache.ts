import type { QueryClient } from "@tanstack/react-query";

type SessionEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type SessionLike = { user?: { id: string } } | null;

/**
 * Avoids carrying private React Query results from one account to another.
 *
 * Supabase emits SIGNED_IN on tab focus as well; retain cache for the *same*
 * account, but discard every query if the authenticated identity changes.
 */
export function createSessionCacheGuard(
  queryClient: Pick<QueryClient, "clear" | "invalidateQueries">,
  invalidateRouter: () => void,
) {
  let previousUserId: string | null | undefined;

  return (event: string, session: SessionLike) => {
    if (event === "SIGNED_OUT") {
      previousUserId = null;
      queryClient.clear();
      invalidateRouter();
      return;
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
      const nextUserId = session?.user?.id ?? null;
      if (previousUserId !== nextUserId) {
        queryClient.clear();
      }
      previousUserId = nextUserId;
      invalidateRouter();
      return;
    }
    if (event === "USER_UPDATED") {
      // Same account, but cached profile or other account metadata may change.
      void queryClient.invalidateQueries();
      invalidateRouter();
    }
  };
}

export type { SessionEvent };
