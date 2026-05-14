"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface ResolutionFilter {
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
}

export interface DateFilter {
  from: string | null;
  to: string | null;
}

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
  // 高级筛选
  resolutionFilter: ResolutionFilter;
  setResolutionFilter: (filter: ResolutionFilter) => void;
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  activeTags: string[];
  setActiveTags: (tags: string[]) => void;
  showAdvancedFilter: boolean;
  setShowAdvancedFilter: (show: boolean) => void;
  resetFilters: () => void;
}

const defaultResolutionFilter: ResolutionFilter = {
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null,
};

const defaultDateFilter: DateFilter = {
  from: null,
  to: null,
};

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
  resolutionFilter: defaultResolutionFilter,
  setResolutionFilter: () => {},
  dateFilter: defaultDateFilter,
  setDateFilter: () => {},
  activeTags: [],
  setActiveTags: () => {},
  showAdvancedFilter: false,
  setShowAdvancedFilter: () => {},
  resetFilters: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "popular">("latest");
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [colorThreshold, setColorThreshold] = useState(30);
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>(defaultResolutionFilter);
  const [dateFilter, setDateFilter] = useState<DateFilter>(defaultDateFilter);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
    setActiveColor(null);
    setColorThreshold(30);
    setResolutionFilter(defaultResolutionFilter);
    setDateFilter(defaultDateFilter);
    setActiveTags([]);
  };

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
        resolutionFilter,
        setResolutionFilter,
        dateFilter,
        setDateFilter,
        activeTags,
        setActiveTags,
        showAdvancedFilter,
        setShowAdvancedFilter,
        resetFilters,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}