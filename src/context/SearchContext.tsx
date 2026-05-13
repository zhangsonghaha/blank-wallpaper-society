"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  favoriteCount: number;
  setFavoriteCount: (count: number) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
  sortBy: "latest" | "popular";
  setSortBy: (sort: "latest" | "popular") => void;
  activeColor: string | null;
  setActiveColor: (color: string | null) => void;
  colorThreshold: number;
  setColorThreshold: (threshold: number) => void;
}

const SearchContext = createContext<SearchContextType>({
  searchQuery: "",
  setSearchQuery: () => {},
  activeCategory: "all",
  setActiveCategory: () => {},
  favoriteCount: 0,
  setFavoriteCount: () => {},
  showFavoritesOnly: false,
  setShowFavoritesOnly: () => {},
  sortBy: "latest",
  setSortBy: () => {},
  activeColor: null,
  setActiveColor: () => {},
  colorThreshold: 30,
  setColorThreshold: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "popular">("latest");
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [colorThreshold, setColorThreshold] = useState(30);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        favoriteCount,
        setFavoriteCount,
        showFavoritesOnly,
        setShowFavoritesOnly,
        sortBy,
        setSortBy,
        activeColor,
        setActiveColor,
        colorThreshold,
        setColorThreshold,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}