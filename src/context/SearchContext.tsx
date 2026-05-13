"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  favoriteCount: number;
  setFavoriteCount: (count: number) => void;
}

const SearchContext = createContext<SearchContextType>({
  searchQuery: "",
  setSearchQuery: () => {},
  activeCategory: "all",
  setActiveCategory: () => {},
  favoriteCount: 0,
  setFavoriteCount: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [favoriteCount, setFavoriteCount] = useState(0);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        favoriteCount,
        setFavoriteCount,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}