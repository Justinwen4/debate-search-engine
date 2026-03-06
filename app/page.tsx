"use client";

import { useState, useCallback, useRef } from "react";

interface Passage {
  chunk_id: string;
  content: string;
  score: number;
  source_url: string;
  source_title: string;
  source_author: string | null;
  published_date: string | null;
}

interface SearchResponse {
  query: string;
  results: Passage[];
  count: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const url = `${API_BASE}/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=20`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);

      const data: SearchResponse = await res.json();
      setResults(data.results);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">
            Debate Search Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Find relevant passages from academic and policy sources
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-4xl mx-auto w-full px-6 pt-8 pb-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "nuclear energy reduces emissions"'
            className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-neutral-400"
          />
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      <main className="max-w-4xl mx-auto w-full px-6 pb-16 flex-1">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <p className="text-sm text-neutral-500 py-8 text-center">
            No passages found. Try a different query.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wide">
              {results.length} passage{results.length !== 1 && "s"} found
            </p>

            {results.map((passage) => (
              <PassageCard key={passage.chunk_id} passage={passage} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PassageCard({ passage }: { passage: Passage }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = passage.content.length > 600;
  const displayText =
    isLong && !expanded ? passage.content.slice(0, 600) + "…" : passage.content;

  return (
    <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      {/* Source metadata */}
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="min-w-0">
          <a
            href={passage.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
          >
            {passage.source_title}
          </a>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
            {passage.source_author && <span>{passage.source_author}</span>}
            {passage.source_author && passage.published_date && (
              <span className="text-neutral-300 dark:text-neutral-600">·</span>
            )}
            {passage.published_date && <span>{passage.published_date}</span>}
          </div>
        </div>
        <span className="text-xs text-neutral-400 tabular-nums shrink-0">
          {(passage.score * 100).toFixed(1)}% match
        </span>
      </div>

      {/* Passage text */}
      <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
        {displayText}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </article>
  );
}
