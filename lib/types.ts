export interface Passage {
  chunk_id: string;
  content: string;
  score: number;
  source_url: string;
  source_title: string;
  source_author: string | null;
  published_date: string | null;
}

export interface SearchResponse {
  query: string;
  results: Passage[];
  count: number;
}

export type SourceType = "academic" | "news" | "policy" | "think-tank" | "all";

export type DateRange = "any" | "week" | "month" | "year" | "5years";

export type DebateEvent = "ld" | "pf" | "policy";

export interface FilterState {
  sourceType: SourceType;
  dateRange: DateRange;
  event: DebateEvent | null;
  topics: string[];
  minScore: number;
}
