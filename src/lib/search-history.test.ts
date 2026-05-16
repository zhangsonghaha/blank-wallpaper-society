import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage
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

import {
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
} from "@/lib/search-history";

describe("search-history", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("getSearchHistory", () => {
    it("returns empty array when no history", () => {
      const result = getSearchHistory();
      expect(result).toEqual([]);
    });

    it("returns stored search history", () => {
      localStorageMock.setItem("search_history", JSON.stringify(["nature", "city"]));
      const result = getSearchHistory();
      expect(result).toEqual(["nature", "city"]);
    });

    it("handles invalid JSON", () => {
      localStorageMock.setItem("search_history", "invalid");
      const result = getSearchHistory();
      expect(result).toEqual([]);
    });
  });

  describe("addSearchHistory", () => {
    it("adds new keyword to front of list", () => {
      addSearchHistory("landscape");
      const result = getSearchHistory();
      expect(result[0]).toBe("landscape");
    });

    it("removes duplicate and moves to front", () => {
      addSearchHistory("nature");
      addSearchHistory("city");
      addSearchHistory("nature");
      const result = getSearchHistory();
      expect(result).toEqual(["nature", "city"]);
      expect(result[0]).toBe("nature");
    });

    it("limits to 20 entries", () => {
      for (let i = 0; i < 25; i++) {
        addSearchHistory("keyword_" + i);
      }
      const result = getSearchHistory();
      expect(result.length).toBe(20);
    });

    it("ignores empty keywords", () => {
      addSearchHistory("");
      addSearchHistory("  ");
      const result = getSearchHistory();
      expect(result).toEqual([]);
    });
  });

  describe("removeSearchHistory", () => {
    it("removes specific keyword", () => {
      addSearchHistory("nature");
      addSearchHistory("city");
      removeSearchHistory("nature");
      const result = getSearchHistory();
      expect(result).toEqual(["city"]);
    });
  });

  describe("clearSearchHistory", () => {
    it("clears all history", () => {
      addSearchHistory("nature");
      addSearchHistory("city");
      clearSearchHistory();
      const result = getSearchHistory();
      expect(result).toEqual([]);
    });
  });
});