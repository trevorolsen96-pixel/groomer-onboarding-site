"use client";

import { useState } from "react";
import { faqs } from "../lib/faq-data";

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-3">
      {faqs.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-2xl border border-[var(--divider-soft)] bg-white/85"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold text-[var(--text-primary)]">
                {item.q}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 flex-none text-[var(--rose-primary)] transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-6 text-[var(--text-secondary)]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
