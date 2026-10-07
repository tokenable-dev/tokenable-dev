"use client";

import { useState } from "react";
import { TkButton } from "@/components/ds";
import { FAQ_GROUPS, FAQ_SUPPORT_EMAIL } from "./faqContent";

function FaqChevron() {
  return (
    <svg className="faq-page__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function FaqPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="faq-page">
      <span className="faq-page__eyebrow">Help center</span>
      <h1 className="faq-page__title">Frequently asked questions</h1>
      <p className="faq-page__sub">
        Everything about buying, selling, custody and redemption on Tokenable. Can&rsquo;t find it?{" "}
        <a className="faq-page__tlink" href={FAQ_SUPPORT_EMAIL}>
          Contact support
        </a>
        .
      </p>

      <div className="faq-page__groups">
        {FAQ_GROUPS.map((group) => (
          <div key={group.heading} className="faq-page__group">
            <h2 className="faq-page__group-h">{group.heading}</h2>
            {group.items.map((item) => {
              const id = `${group.heading}:${item.q}`;
              const isOpen = Boolean(open[id]);
              return (
                <div key={item.q} className={`faq-page__item${isOpen ? " faq-page__item--open" : ""}`}>
                  <button
                    type="button"
                    className="faq-page__q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
                  >
                    {item.q}
                    <FaqChevron />
                  </button>
                  <div className="faq-page__a">
                    <div className="faq-page__a-inner">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="faq-page__cta">
        <div>
          <h2>Still have a question?</h2>
          <p>Our team replies within one business day.</p>
        </div>
        <TkButton href={FAQ_SUPPORT_EMAIL} variant="primary" className="faq-page__cta-btn">
          Contact support
        </TkButton>
      </div>
    </section>
  );
}
