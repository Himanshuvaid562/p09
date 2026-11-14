"use client";
import { useEffect } from "react";

// If the login state of this tab is out of date, reload it. The server then decides where it belongs
// (a logged-out tab on a dashboard goes to /login, a logged-in tab on /login goes to its dashboard).
export default function AuthSync({ loggedIn }) {
  useEffect(() => {
    // 1. the browser brought this page back from its back/forward cache
    function onShow(e) {
      if (e.persisted) window.location.reload();
    }

    // 2. someone logged in or out in another tab
    function onStorage(e) {
      if (e.key === "p09_auth") window.location.reload();
    }

    // 3. coming back to this tab: does the server still agree with what it shows?
    async function recheck() {
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok !== loggedIn) window.location.reload();
    }

    window.addEventListener("pageshow", onShow);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [loggedIn]);

  return null;
}
