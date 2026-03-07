"use client";

import {
  FileText,
  Newspaper,
  Building2,
  GraduationCap,
  Globe,
  Calendar,
  Tag,
  SlidersHorizontal,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceType, DateRange, DebateEvent, FilterState } from "@/lib/types";

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const DEBATE_EVENTS: { value: DebateEvent; label: string }[] = [
  { value: "ld", label: "Lincoln-Douglas" },
  { value: "pf", label: "Public Forum" },
  { value: "policy", label: "Policy" },
];

const SOURCE_TYPES: { value: SourceType; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All sources", icon: Globe },
  { value: "academic", label: "Academic", icon: GraduationCap },
  { value: "news", label: "News", icon: Newspaper },
  { value: "policy", label: "Policy", icon: FileText },
  { value: "think-tank", label: "Think tanks", icon: Building2 },
];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
  { value: "5years", label: "Past 5 years" },
];

const EVENT_TOPICS: Record<DebateEvent, string[]> = {
  ld: ["Ethics", "Individual Rights", "Justice", "Democracy", "Social Contract", "Philosophy"],
  pf: ["Foreign Policy", "Economics", "Domestic Policy", "Technology", "Environment", "Security"],
  policy: ["Climate & Energy", "Healthcare", "Immigration", "Defense", "Trade", "Criminal Justice"],
};

const DEFAULT_TOPICS = [
  "Foreign Policy",
  "Economics",
  "Climate & Energy",
  "Healthcare",
  "Technology",
  "Criminal Justice",
];

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const topics = filters.event ? EVENT_TOPICS[filters.event] : DEFAULT_TOPICS;

  return (
    <aside className="w-[240px] shrink-0 border-r bg-card overflow-y-auto scrollbar-thin">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Filters
          </span>
        </div>

        <FilterSection label="Event" icon={Scale}>
          <div className="flex flex-wrap gap-1.5">
            {DEBATE_EVENTS.map(({ value, label }) => {
              const active = filters.event === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    const next = active ? null : value;
                    onFilterChange({ ...filters, event: next, topics: [] });
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors",
                    active
                      ? "border-accent bg-accent-muted text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-border-hover hover:text-foreground hover:bg-surface",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection label="Source type" icon={FileText}>
          <div className="space-y-0.5">
            {SOURCE_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() =>
                  onFilterChange({ ...filters, sourceType: value })
                }
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                  filters.sourceType === value
                    ? "bg-accent-muted text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Date range" icon={Calendar}>
          <div className="space-y-0.5">
            {DATE_RANGES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() =>
                  onFilterChange({ ...filters, dateRange: value })
                }
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                  filters.dateRange === value
                    ? "bg-accent-muted text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Topics" icon={Tag}>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => {
              const active = filters.topics.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => {
                    const next = active
                      ? filters.topics.filter((t) => t !== topic)
                      : [...filters.topics, topic];
                    onFilterChange({ ...filters, topics: next });
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[12px] border transition-colors",
                    active
                      ? "border-accent bg-accent-muted text-accent-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-border-hover hover:text-foreground",
                  )}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}

function FilterSection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
