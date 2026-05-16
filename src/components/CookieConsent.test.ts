import { describe, it, expect, beforeEach } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

import { getCookieConsent } from "@/components/CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("getCookieConsent", () => {
    it("returns 'none' when no consent stored", () => {
      expect(getCookieConsent()).toBe("none");
    });

    it("returns stored consent level", () => {
      localStorageMock.setItem(
        "cookie_consent",
        JSON.stringify({ level: "all", timestamp: "2026-05-16T00:00:00Z" })
      );
      expect(getCookieConsent()).toBe("all");
    });

    it("returns 'necessary' level", () => {
      localStorageMock.setItem(
        "cookie_consent",
        JSON.stringify({ level: "necessary", timestamp: "2026-05-16T00:00:00Z" })
      );
      expect(getCookieConsent()).toBe("necessary");
    });

    it("handles invalid JSON", () => {
      localStorageMock.setItem("cookie_consent", "invalid");
      expect(getCookieConsent()).toBe("none");
    });
  });
});