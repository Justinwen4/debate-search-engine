"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { FilterSidebar } from "@/components/filter-sidebar";
import { ResultCard } from "@/components/result-card";
import { SourcePanel } from "@/components/source-panel";
import type { Passage, FilterState, DebateEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULT_FILTERS: FilterState = {
  sourceType: "all",
  dateRange: "any",
  event: null,
  topics: [],
  minScore: 0,
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchCount, setSearchCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const resultListRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (queryOverride?: string) => {
      const trimmed = (queryOverride ?? query).trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setSearched(true);
      setSelectedPassage(null);
      setSelectedIndex(-1);

      try {
        const params = new URLSearchParams({ q: trimmed, limit: "20" });
        if (filters.sourceType !== "all")
          params.set("source_type", filters.sourceType);
        if (filters.dateRange !== "any")
          params.set("date_range", filters.dateRange);
        if (filters.minScore > 0)
          params.set("min_score", String(filters.minScore));
        filters.topics.forEach((t) => params.append("topic", t));

        const url = `${API_BASE}/api/v1/search?${params.toString()}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);

        const data = await res.json();
        setResults(data.results);
        if (data.results.length > 0) setSearchCount((c) => c + 1);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query, filters],
  );

  const searchQuery = useCallback(
    (q: string) => {
      setQuery(q);
      search(q);
    },
    [search],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("input[type=text]")?.focus();
      }

      if (results.length === 0) return;

      if (e.key === "ArrowDown" || (e.key === "j" && !isInputFocused())) {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, results.length - 1);
          setSelectedPassage(results[next]);
          return next;
        });
      }

      if (e.key === "ArrowUp" || (e.key === "k" && !isInputFocused())) {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          setSelectedPassage(results[next]);
          return next;
        });
      }

      if (e.key === "Escape") {
        setSelectedPassage(null);
        setSelectedIndex(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results]);

  useEffect(() => {
    if (searched) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      <SearchBar
        value={query}
        onChange={setQuery}
        onSearch={search}
        loading={loading}
        resultCount={searched ? results.length : undefined}
        searchCount={searchCount}
      />

      <div className="flex flex-1 overflow-hidden">
        <FilterSidebar filters={filters} onFilterChange={setFilters} />

        <main
          ref={resultListRef}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          {!searched && !loading && (
            <EmptyState onSuggest={searchQuery} event={filters.event} />
          )}

          {error && (
            <div className="m-5 rounded-lg border border-destructive/20 bg-destructive-muted p-4 text-[13px] text-destructive">
              {error}
            </div>
          )}

          {searched && !loading && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-3">
                <Search className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-medium text-foreground mb-1">
                No results found
              </p>
              <p className="text-[13px] text-muted-foreground">
                Try adjusting your search terms or filters.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-5 space-y-3">
              <AnimatePresence>
                {results.map((passage, i) => (
                  <ResultCard
                    key={passage.chunk_id}
                    passage={passage}
                    index={i}
                    isSelected={selectedPassage?.chunk_id === passage.chunk_id}
                    onSelect={() => {
                      setSelectedPassage(passage);
                      setSelectedIndex(i);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>

        <SourcePanel
          passage={selectedPassage}
          onClose={() => {
            setSelectedPassage(null);
            setSelectedIndex(-1);
          }}
        />
      </div>
    </div>
  );
}

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

const EVENT_SUGGESTIONS: Record<DebateEvent, string[]> = {
  ld: [
    "Individual rights vs collective welfare",
    "Civil disobedience and justice",
    "Privacy rights vs national security",
    "Moral obligation to assist refugees",
  ],
  pf: [
    "NATO expansion implications",
    "US-China economic decoupling",
    "Social media regulation",
    "Nuclear energy policy",
  ],
  policy: [
    "Carbon tax plan advantages",
    "Universal healthcare solvency",
    "Immigration reform impacts",
    "Nuclear deterrence credibility",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Nuclear deterrence",
  "Carbon tax policy",
  "AI regulation",
  "Universal basic income",
  "Drug decriminalization",
  "NATO expansion",
];

const EVENT_LABELS: Record<DebateEvent, string> = {
  ld: "Lincoln-Douglas",
  pf: "Public Forum",
  policy: "Policy",
};

interface EmptyStateProps {
  onSuggest: (query: string) => void;
  event: DebateEvent | null;
}

function EmptyState({ onSuggest, event }: EmptyStateProps) {
  const suggestions = event ? EVENT_SUGGESTIONS[event] : DEFAULT_SUGGESTIONS;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-4 mx-auto">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <h2 className="text-[18px] font-semibold text-foreground mb-1.5">
          Search debate evidence
        </h2>
        <p className="text-[14px] text-muted-foreground max-w-[400px] leading-relaxed">
          Find relevant passages from academic papers, policy briefs, think
          tanks, and news sources. Filter by event type, source type, and
          recency.
        </p>
        {event && (
          <p className="mt-3 text-[12px] font-medium text-accent-foreground">
            Showing suggestions for {EVENT_LABELS[event]}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {suggestions.map((label) => (
            <SuggestionChip
              key={label}
              label={label}
              onClick={() => onSuggest(label)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:border-border-hover hover:bg-surface transition-colors"
    >
      {label}
    </button>
  );
}
