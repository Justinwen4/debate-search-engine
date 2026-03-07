"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, ArrowRight, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "debate-search-history";
const MAX_HISTORY = 8;

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
  resultCount?: number;
  searchCount?: number;
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function persistHistory(items: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  loading,
  resultCount,
  searchCount,
}: SearchBarProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevSearchCount = useRef(searchCount ?? 0);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (searchCount == null) return;
    if (searchCount > prevSearchCount.current && value.trim()) {
      setHistory((prev) => {
        const deduped = [value.trim(), ...prev.filter((h) => h !== value.trim())].slice(0, MAX_HISTORY);
        persistHistory(deduped);
        return deduped;
      });
    }
    prevSearchCount.current = searchCount;
  }, [searchCount, value]);

  const filteredHistory = value.trim()
    ? history.filter((h) => h.toLowerCase().includes(value.trim().toLowerCase()))
    : history;

  const shouldShow = showHistory && filteredHistory.length > 0;

  const removeItem = useCallback((item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const next = prev.filter((h) => h !== item);
      persistHistory(next);
      return next;
    });
  }, []);

  const selectItem = useCallback(
    (item: string) => {
      onChange(item);
      setShowHistory(false);
      setTimeout(onSearch, 0);
    },
    [onChange, onSearch],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowHistory(false);
      onSearch();
    }
    if (e.key === "Escape") {
      setShowHistory(false);
    }
  };

  const handleFocus = () => {
    setShowHistory(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        setShowHistory(false);
      }
    }, 150);
  };

  return (
    <div className="border-b bg-card">
      <div className="px-5 py-4">
        <div ref={wrapperRef} className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search claims, evidence, and sources..."
            className={cn(
              "w-full rounded-lg border bg-background pl-10 pr-24 py-2.5",
              "text-[14px] placeholder:text-muted-foreground/60",
              "transition-shadow duration-150",
              "focus:shadow-[var(--shadow-focus)] focus:border-accent",
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {value.trim() && !loading && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setShowHistory(false);
                  onSearch();
                }}
                className="flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-foreground/90"
              >
                Search
                <ArrowRight className="w-3 h-3" />
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {shouldShow && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-lg shadow-sm py-1 z-50"
              >
                {filteredHistory.map((item) => (
                  <div
                    key={item}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectItem(item)}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface text-[13px] text-foreground"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{item}</span>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => removeItem(item, e)}
                      className="p-0.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {resultCount !== undefined && resultCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2.5 text-[12px] text-muted-foreground"
          >
            {resultCount} passage{resultCount !== 1 && "s"} found
          </motion.p>
        )}
      </div>
    </div>
  );
}
