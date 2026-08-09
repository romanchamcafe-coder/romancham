"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * AppSplashScreen
 *
 * A lightweight, CSS-driven launch splash for the Romancham PWA.
 *
 * Design goals:
 * - Shows once per browser session (sessionStorage), so it appears on a fresh
 *   home-screen launch but NOT during in-app navigation or React re-renders.
 * - Purely time-based and independent of Supabase auth / network, so it can
 *   never block sign-in and the user can never get stuck on it.
 * - Hydration-safe: the first server and client render are identical
 *   (overlay visible); the session check runs only inside useEffect.
 * - The overlay also carries its own CSS fade-out (see globals.css) as a
 *   safety net in case this component's timer never fires.
 *
 * Works identically on iOS Safari and Android Chrome standalone PWAs.
 */

const SESSION_KEY = "rc_splash_shown";

export function AppSplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage can be unavailable (private mode / blocked); fall through.
    }

    if (alreadyShown) {
      // Same session (e.g. a reload or navigation) — don't replay the splash.
      setShow(false);
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Keep total on-screen time under ~3s. Matches the CSS fade-out timings.
    const totalMs = reduce ? 900 : 2800;
    const timer = window.setTimeout(() => setShow(false), totalMs);

    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="rc-splash" role="presentation" aria-hidden="true">
      <span className="rc-splash__glow" />
      <Image
        src="/logo.png"
        alt="Romancham"
        width={260}
        height={68}
        priority
        className="rc-splash__logo"
      />
      <span className="rc-splash__bar" />
    </div>
  );
}

export default AppSplashScreen;
