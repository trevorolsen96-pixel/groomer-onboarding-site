"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "./supabase-client";

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setLoggedIn(Boolean(data.session?.user));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { loading, loggedIn };
}
