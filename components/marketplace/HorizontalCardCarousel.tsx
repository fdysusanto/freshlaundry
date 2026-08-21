'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalCardCarouselProps {
  children: React.ReactNode;
  className?: string;
}

export const HorizontalCardCarousel: React.FC<HorizontalCardCarouselProps> = ({
  children,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [children]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Desktop Navigation Arrow - Left */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          aria-label="Scroll Kiri"
          className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-teal-700 shadow-xl items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-30 cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Horizontal Scrolling Track */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-stretch gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory py-2 px-1 -mx-1 transition-all"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {React.Children.map(children, (child, idx) => (
          <div
            key={idx}
            className="w-[82%] sm:w-[48%] md:w-[31%] lg:w-[24%] xl:w-[20%] shrink-0 snap-start flex flex-col"
          >
            {child}
          </div>
        ))}
      </div>

      {/* Desktop Navigation Arrow - Right */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          aria-label="Scroll Kanan"
          className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-teal-700 shadow-xl items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-30 cursor-pointer active:scale-95"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
