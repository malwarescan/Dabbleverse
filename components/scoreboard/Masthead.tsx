'use client';

import { useState, useEffect } from 'react';
import { WindowType } from '@/lib/types';

const SCROLL_THRESHOLD = 100;

interface MastheadProps {
  currentWindow?: WindowType;
  onWindowChange?: (window: WindowType) => void;
  lastUpdate?: string;
}

export function Masthead(_props: MastheadProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 box-content bg-transparent">
      <div
        className="max-w-7xl mx-auto px-4 box-content relative overflow-hidden bg-transparent"
        style={{
          paddingTop: isScrolled ? '0.5rem' : '0.75rem',
          paddingBottom: isScrolled ? '0.5rem' : '0.75rem',
          transition: 'padding 0.4s ease-out',
        }}
      >
        {/* Full logo: recedes to top and evaporates on scroll down; rolls out from top on scroll up */}
        <div
          className="flex justify-center items-center"
          style={{
            transform: isScrolled
              ? 'translateY(-100%) scale(0.7)'
              : 'translateY(0) scale(1)',
            opacity: isScrolled ? 0 : 1,
            pointerEvents: isScrolled ? 'none' : 'auto',
            transition: 'transform 0.5s ease-out, opacity 0.5s ease-out',
          }}
        >
          <img
            src="/dabbleverse-logo.png"
            alt="Dabbleverse"
            className="h-[120px] sm:h-[132px] md:h-36 lg:h-40 w-auto object-contain transition-all duration-500 ease-out"
            style={{
              width: '459px',
              height: '160px',
              filter: 'drop-shadow(0 0 20px rgba(230, 57, 70, 0.5))',
            }}
          />
        </div>

        {/* D logo + Playboard link: pop up when scrolled */}
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-4 transition-all duration-400 ease-out"
          style={{
            opacity: isScrolled ? 1 : 0,
            transform: isScrolled
              ? 'translateY(-50%) scale(1)'
              : 'translateY(-50%) scale(0.85) translateX(-12px)',
            pointerEvents: isScrolled ? 'auto' : 'none',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
          }}
        >
          <img
            src="/dabbleverse-D-isolated.png"
            alt=""
            className="h-7 sm:h-8 md:h-9 w-auto object-contain"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(230, 57, 70, 0.4))',
            }}
            aria-hidden
          />
          <a
            href="/playboard"
            className="text-sm font-bold hover:underline"
            style={{ color: 'var(--color-broadcast-accent)' }}
          >
            Playboard
          </a>
        </div>
      </div>
    </div>
  );
}
