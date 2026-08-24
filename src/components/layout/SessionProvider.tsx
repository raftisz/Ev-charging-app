"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api-client";
import type { UserDTO } from "@/lib/types";

type SessionValue = {
  user: UserDTO;
  unread: number;
  refreshUser: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setUser: (user: UserDTO) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: UserDTO;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const { unread: count } = await api.notifications();
      setUnread(count);
    } catch {
      /* the bell badge is not worth surfacing an error for */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fresh } = await api.profile();
      setUser(fresh);
    } catch {
      /* keep the last known user */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .notifications()
      .then((result) => {
        if (alive) setUnread(result.unread);
      })
      .catch(() => {
        /* the bell badge is not worth surfacing an error for */
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, unread, refreshUser, refreshUnread, setUser }),
    [user, unread, refreshUser, refreshUnread],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
