"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Calendar,
  User,
  Link2,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { Passage } from "@/lib/types";
import { buildDebateCard, formatCardAsText } from "@/lib/card-formatter";

type PanelTab = "passage" | "card";

interface SourcePanelProps {
  passage: Passage | null;
  onClose: () => void;
}

export function SourcePanel({ passage, onClose }: SourcePanelProps) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<PanelTab>("passage");
  const [tag, setTag] = useState("");
  const [cardCopied, setCardCopied] = useState(false);

  const card = useMemo(
    () => (passage ? buildDebateCard(passage, tag) : null),
    [passage, tag],
  );

  const handleCopy = () => {
    if (!passage) return;
    navigator.clipboard.writeText(passage.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCard = () => {
    if (!card) return;
    navigator.clipboard.writeText(formatCardAsText(card));
    setCardCopied(true);
    setTimeout(() => setCardCopied(false), 2000);
  };

  const tabClass = (active: boolean) =>
    active
      ? "bg-accent-muted text-accent-foreground font-medium rounded-md px-2.5 py-1 text-[12px]"
      : "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-[12px]";

  return (
    <AnimatePresence mode="wait">
      {passage && (
        <motion.aside
          key={passage.chunk_id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.15 }}
          className="w-[380px] shrink-0 border-l bg-card overflow-y-auto scrollbar-thin"
        >
          <div className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source Preview
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            <h2 className="text-[16px] font-semibold leading-snug text-foreground mb-4">
              {passage.source_title}
            </h2>

            <div className="space-y-2.5 mb-6">
              {passage.source_author && (
                <MetadataRow icon={User} label="Author" value={passage.source_author} />
              )}
              {passage.published_date && (
                <MetadataRow
                  icon={Calendar}
                  label="Published"
                  value={passage.published_date}
                />
              )}
              <MetadataRow
                icon={Link2}
                label="URL"
                value={
                  <a
                    href={passage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline truncate block max-w-[240px]"
                  >
                    {new URL(passage.source_url).hostname}
                  </a>
                }
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTab("passage")}
                    className={tabClass(tab === "passage")}
                  >
                    Passage
                  </button>
                  <button
                    onClick={() => setTab("card")}
                    className={tabClass(tab === "card")}
                  >
                    Card Format
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <RelevanceBadge score={passage.score} />
                  {tab === "passage" && (
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {tab === "passage" && (
                <blockquote className="border-l-2 border-accent/30 pl-4 text-[13px] leading-[1.8] text-foreground/85 whitespace-pre-line">
                  {passage.content}
                </blockquote>
              )}

              {tab === "card" && card && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="e.g. Carbon-free energy solves grid instability"
                    className="w-full rounded-md border bg-surface px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />

                  <div className="rounded-md border bg-surface/50 p-4">
                    <p className="text-[16px] font-bold text-foreground leading-snug">
                      {card.shortCite}
                    </p>
                    <p className="text-[12px] text-muted-foreground italic mt-0.5">
                      {card.fullCite}
                    </p>
                    {tag && (
                      <p className="text-[13px] font-semibold text-foreground mt-3">
                        [{tag}]
                      </p>
                    )}
                    <blockquote className="border-l-2 border-accent/30 pl-4 text-[13px] leading-[1.8] text-foreground/85 whitespace-pre-line mt-3">
                      {card.passage}
                    </blockquote>
                  </div>

                  <button
                    onClick={handleCopyCard}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface transition-colors"
                  >
                    {cardCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {cardCopied ? "Card Copied" : "Copy Card"}
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <a
                href={passage.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View original source
              </a>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MetadataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground w-[90px]">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <div className="text-foreground min-w-0">{value}</div>
    </div>
  );
}

function RelevanceBadge({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  return (
    <span className="inline-flex items-center rounded-md bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent-foreground tabular-nums">
      {percent}% match
    </span>
  );
}
