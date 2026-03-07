"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  ChevronDown,
  Quote,
  Bookmark,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Passage } from "@/lib/types";

interface ResultCardProps {
  passage: Passage;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function ResultCard({
  passage,
  index,
  isSelected,
  onSelect,
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLong = passage.content.length > 400;
  const displayText =
    isLong && !expanded ? passage.content.slice(0, 400) + "..." : passage.content;

  const scorePercent = (passage.score * 100).toFixed(0);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(passage.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      onClick={onSelect}
      className={cn(
        "group rounded-lg border p-4 cursor-pointer transition-all duration-150",
        isSelected
          ? "border-accent bg-accent-muted/40 shadow-xs"
          : "bg-card hover:border-border-hover hover:shadow-xs",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug text-foreground line-clamp-2">
            {passage.source_title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
            {passage.source_author && (
              <span className="truncate max-w-[180px]">
                {passage.source_author}
              </span>
            )}
            {passage.source_author && passage.published_date && (
              <span className="text-border-hover">·</span>
            )}
            {passage.published_date && (
              <span className="shrink-0">{passage.published_date}</span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums",
            Number(scorePercent) >= 80
              ? "bg-emerald-50 text-emerald-700"
              : Number(scorePercent) >= 60
                ? "bg-amber-50 text-amber-700"
                : "bg-surface text-muted-foreground",
          )}
        >
          {scorePercent}%
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-0 left-0 text-border">
          <Quote className="w-3 h-3" />
        </div>
        <p className="text-[13px] leading-[1.7] text-foreground/80 pl-5">
          {displayText}
        </p>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <div className="flex items-center gap-1">
          {isLong && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
              {expanded ? "Less" : "More"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButton
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy"}
            onClick={handleCopy}
          />
          <ActionButton icon={Bookmark} label="Save" />
          <a
            href={passage.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Source
          </a>
        </div>
      </div>
    </motion.article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
