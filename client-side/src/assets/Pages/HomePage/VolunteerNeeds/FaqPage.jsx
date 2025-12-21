import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';

import bg1 from '../../../images/banner/10.jpg'
// Simple intersection observer hook to reveal elements with transitions
function useReveal(options) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, ...(options || {}) }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, visible };
}

function PlusMinusIcon({ open }) {
  return (
    <span
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-white w-9 h-9"
    >
      {/* Circle background handled by parent; draw + or - */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
      >
        {/* Horizontal bar */}
        <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Vertical bar (hidden when open = minus) */}
        {!open && (
          <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

function AccordionItem({ id, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const contentId = `accordion-panel-${id}`;
  const buttonId = `accordion-button-${id}`;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        id={buttonId}
        className="w-full flex items-center justify-between text-left font-semibold px-6 py-5 hover:text-black text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-controls={contentId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="pr-4">{title}</span>
        <PlusMinusIcon open={open} />
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        className="grid transition-all duration-300"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-0 text-gray-700 leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage({ title = "FAQ" }) {
  const heroBg = useMemo(
    () =>
      `url(${bg1})`,
    []
  );

  // Reveal effects for hero items
  const h1Reveal = useReveal();
  const pReveal = useReveal({ threshold: 0.15 });
  const leftBtnReveal = useReveal({ threshold: 0.15 });
  const rightBtnReveal = useReveal({ threshold: 0.15 });

  const { t } = useTranslation();
  const faqSections = [
    { id: 'getting-started' },
    { id: 'features' },
    { id: 'more-info' }
  ];

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = t('faq.title', title || 'FAQ');
    }
  }, [title, t]);

  return (
    <div className="w-full text-gray-900">
      {/* Hero Section */}
      <section
        className="relative text-center text-white"
        aria-label="Giới thiệu"
      >
        <div
          className={[
            "relative",
            "bg-cover bg-center",
            "min-h-[229px] sm:min-h-[363px] lg:min-h-[440px] xl:min-h-[534px]",
            "flex items-center",
          ].join(" ")}
          style={{ backgroundImage: heroBg }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-[1100px] mx-auto px-4">
            <h1
              ref={h1Reveal.ref}
              className={`font-bold text-3xl sm:text-4xl md:text-5xl transition duration-1000 ${h1Reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}
            >
              {t('faq.title', 'FAQ')}
            </h1>
            <p
              ref={pReveal.ref}
              className={`mt-5 mx-auto max-w-[340px] sm:max-w-[540px] md:max-w-[720px] xl:max-w-[910px] text-base sm:text-lg transition duration-1000 ${pReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              {t('faq.hero.desc', "First time using VolunteerHub? Don't worry! Here are some frequently asked questions.")}
            </p>

            <div className="mt-8 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4 max-w-[562px] mx-auto">
              <div ref={leftBtnReveal.ref}>
                <a href="https://www.facebook.com/thainguyenzeno" className={`inline-block uppercase tracking-wide font-bold text-sm px-6 py-3 rounded-full border-2 bg-primary border-primary text-white transition duration-700 ${leftBtnReveal.visible ? 'opacity-100 -translate-x-0' : 'opacity-0 -translate-x-8'}`}>
                  {t('faq.hero.community', 'Community Page')}
                </a>
              </div>
              <div ref={rightBtnReveal.ref} className="text-left sm:text-left">
                <a href="https://www.youtube.com/@xt-aorongmobile9890" className={`inline-block uppercase tracking-wide font-bold text-sm px-6 py-3 rounded-full border-2 border-white text-white hover:bg-white hover:text-black transition duration-700 ${rightBtnReveal.visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
                  {t('faq.hero.youtube', 'YouTube Channel')}
                </a>
              </div>
            </div>
          </div>
            </div>
        </section>

      {/* FAQ Section */}
      <section className="bg-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-semibold text-center">
            {t('faq.heading', 'Facts & Questions')}
          </h2>

          <p className="text-center mt-5 max-w-[864px] mx-auto text-gray-700">
            {t('faq.lead', 'Sample text. Click to select the text box.')}
          </p>

          <div className="mt-10 space-y-10">
            {faqSections.map((section) => {
              const title = t(`faq.sections.${section.id}.title`);
              const items = t(`faq.sections.${section.id}.items`, { returnObjects: true }) || [];
              return (
                <div key={section.id}>
                  <h3 className="text-xl font-semibold mb-4">{title}</h3>
                  <div className="space-y-4">
                    {items.map((item, idx) => (
                      <AccordionItem key={idx} id={`${section.id}-${idx}`} title={item.q}>
                        <p>{item.a}</p>
                      </AccordionItem>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}

// Tailwind helpers: define a primary color via CSS variable fallback
// You can map this to your Tailwind config theme.colors.primary
// Here, we provide a minimal runtime fallback using a utility class.
// Add this in your global CSS if not using Tailwind theme extension:
// .bg-primary { background-color: #f5bb08; }
// .text-primary { color: #f5bb08; }
// .border-primary { border-color: #f5bb08; }