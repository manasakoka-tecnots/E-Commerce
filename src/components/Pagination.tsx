"use client";

import { useMemo, useState } from "react";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** Label shown as "Showing X-Y of Z {itemLabel}" */
  itemLabel?: string;
};

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemLabel = "items",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const pages = useMemo(() => {
    const result: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (currentPage > 3) result.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) result.push(i);
      if (currentPage < totalPages - 2) result.push("...");
      result.push(totalPages);
    }
    return result;
  }, [currentPage, totalPages]);

  if (totalItems <= itemsPerPage) return null;

  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col items-center gap-3 pt-6 sm:flex-row sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-slate-700">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page buttons */}
        {pages.map((page, idx) =>
          page === "..." ? (
            <span key={`dots-${idx}`} className="flex h-9 w-9 items-center justify-center text-sm text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border text-sm font-medium transition ${
                page === currentPage
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Overload: 2 args — manages its own page state, returns object */
export function usePagination<T>(items: T[], perPage: number): { currentPage: number; setCurrentPage: (p: number) => void; paginatedItems: T[] };
/** Overload: 3 args — uses external page state, returns plain array */
export function usePagination<T>(items: T[], page: number, perPage: number): T[];
export function usePagination<T>(items: T[], pageOrPerPage: number, maybePerPage?: number): { currentPage: number; setCurrentPage: (p: number) => void; paginatedItems: T[] } | T[] {
  const isManaged = maybePerPage === undefined;
  const [internalPage, setInternalPage] = useState(1);

  const perPage = isManaged ? pageOrPerPage : maybePerPage;
  const externalPage = isManaged ? internalPage : pageOrPerPage;

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(externalPage, totalPages);

  const sliced = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, safePage, perPage]);

  if (isManaged) {
    return { currentPage: safePage, setCurrentPage: setInternalPage, paginatedItems: sliced };
  }
  return sliced;
}
