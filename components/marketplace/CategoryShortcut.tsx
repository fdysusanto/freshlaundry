'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ServiceCategory } from '@/types/laundry';
import { LayoutGrid, Shirt, Footprints, ShoppingBag, Layers, Sofa } from 'lucide-react';

export type CategoryFilterType = ServiceCategory | 'Semua';

interface CategoryShortcutProps {
  selectedCategory: CategoryFilterType;
  onSelectCategory: (category: CategoryFilterType) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  hideBottomToggle?: boolean;
  onHasMoreThanTwoRowsChange?: (hasMore: boolean) => void;
}

interface CategoryOption {
  key: CategoryFilterType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  inactiveIconStyle: string;
  activeCardStyle: string;
  activeIconStyle: string;
  hoverBorderStyle: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: 'Semua',
    label: 'Semua',
    icon: LayoutGrid,
    inactiveIconStyle: 'bg-slate-100 text-slate-700 border border-slate-200/60',
    activeCardStyle: 'bg-brand-surface border-2 border-brand-primary text-brand-primary font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-brand-primary text-white',
    hoverBorderStyle: 'hover:border-brand-primary/50',
  },
  {
    key: 'Pakaian',
    label: 'Pakaian',
    icon: Shirt,
    inactiveIconStyle: 'bg-sky-50 text-sky-600 border border-sky-100',
    activeCardStyle: 'bg-sky-50/90 border-2 border-sky-500 text-sky-950 font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-sky-500 text-white',
    hoverBorderStyle: 'hover:border-sky-300',
  },
  {
    key: 'Sepatu & Sandal',
    label: 'Sepatu & Sandal',
    icon: Footprints,
    inactiveIconStyle: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    activeCardStyle: 'bg-emerald-50/90 border-2 border-emerald-500 text-emerald-950 font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-emerald-500 text-white',
    hoverBorderStyle: 'hover:border-emerald-300',
  },
  {
    key: 'Tas',
    label: 'Tas',
    icon: ShoppingBag,
    inactiveIconStyle: 'bg-amber-50 text-amber-600 border border-amber-100',
    activeCardStyle: 'bg-amber-50/90 border-2 border-amber-500 text-amber-950 font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-amber-500 text-white',
    hoverBorderStyle: 'hover:border-amber-300',
  },
  {
    key: 'Karpet',
    label: 'Karpet',
    icon: Layers,
    inactiveIconStyle: 'bg-purple-50 text-purple-600 border border-purple-100',
    activeCardStyle: 'bg-purple-50/90 border-2 border-purple-500 text-purple-950 font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-purple-500 text-white',
    hoverBorderStyle: 'hover:border-purple-300',
  },
  {
    key: 'Sofa',
    label: 'Sofa',
    icon: Sofa,
    inactiveIconStyle: 'bg-rose-50 text-rose-600 border border-rose-100',
    activeCardStyle: 'bg-rose-50/90 border-2 border-rose-500 text-rose-950 font-black shadow-xs scale-[1.03]',
    activeIconStyle: 'bg-rose-500 text-white',
    hoverBorderStyle: 'hover:border-rose-300',
  },
];

export const CategoryShortcut: React.FC<CategoryShortcutProps> = ({
  selectedCategory,
  onSelectCategory,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
  hideBottomToggle = false,
  onHasMoreThanTwoRowsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [hasMoreThanTwoRows, setHasMoreThanTwoRows] = useState(false);
  const [maxHeightTwoRows, setMaxHeightTwoRows] = useState<number | undefined>(undefined);

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalIsExpanded(!internalIsExpanded);
    }
  };

  // Measure row heights dynamically based on layout
  const checkRowCapacity = useCallback(() => {
    if (!containerRef.current) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    if (children.length === 0) return;

    const rowTops: number[] = [];
    children.forEach((child) => {
      const top = child.offsetTop;
      if (!rowTops.some((t) => Math.abs(t - top) < 6)) {
        rowTops.push(top);
      }
    });

    rowTops.sort((a, b) => a - b);

    const hasMore = rowTops.length > 2;
    setHasMoreThanTwoRows(hasMore);
    if (onHasMoreThanTwoRowsChange) {
      onHasMoreThanTwoRowsChange(hasMore);
    }

    if (hasMore) {
      const containerTop = containerRef.current.offsetTop;
      const thirdRowTop = rowTops[2];
      const calcMaxH = thirdRowTop - containerTop - 4; // Buffer between 2nd and 3rd row
      setMaxHeightTwoRows(calcMaxH > 0 ? calcMaxH : undefined);
    } else {
      setMaxHeightTwoRows(undefined);
    }
  }, [onHasMoreThanTwoRowsChange]);

  useEffect(() => {
    checkRowCapacity();
    const handleResize = () => checkRowCapacity();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkRowCapacity]);

  // Auto-expand if the selected category happens to be on a collapsed 3rd+ row
  useEffect(() => {
    if (!containerRef.current || isExpanded) return;
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    const activeIndex = CATEGORY_OPTIONS.findIndex((c) => c.key === selectedCategory);
    if (activeIndex >= 0 && children[activeIndex]) {
      const activeTop = children[activeIndex].offsetTop;
      const containerTop = containerRef.current.offsetTop;
      if (maxHeightTwoRows !== undefined && activeTop - containerTop >= maxHeightTwoRows) {
        if (onToggleExpand) {
          onToggleExpand();
        } else {
          setInternalIsExpanded(true);
        }
      }
    }
  }, [selectedCategory, isExpanded, maxHeightTwoRows, onToggleExpand]);

  return (
    <div className="w-full">
      {/* 2-Row Collapsible Grid Container */}
      <div
        ref={containerRef}
        style={
          !isExpanded && maxHeightTwoRows !== undefined
            ? { maxHeight: `${maxHeightTwoRows}px` }
            : undefined
        }
        className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3 py-1 px-0.5 transition-[max-height] duration-300 ease-in-out ${
          !isExpanded && hasMoreThanTwoRows ? 'overflow-hidden' : ''
        }`}
      >
        {CATEGORY_OPTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = selectedCategory === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectCategory(item.key)}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer select-none w-full ${
                isActive
                  ? item.activeCardStyle
                  : `bg-white text-slate-700 border border-slate-200/90 font-semibold hover:bg-slate-50 ${item.hoverBorderStyle}`
              }`}
            >
              <div
                className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
                  isActive ? item.activeIconStyle : item.inactiveIconStyle
                }`}
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
              </div>
              <span className="text-[11px] sm:text-xs tracking-tight text-center line-clamp-1">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toggle Expand/Collapse Link */}
      {!hideBottomToggle && hasMoreThanTwoRows && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={handleToggleExpand}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:text-brand-primary/80 transition-colors py-1 px-3 rounded-lg hover:bg-brand-surface cursor-pointer select-none"
          >
            <span>{isExpanded ? 'Tampilkan Lebih Sedikit ↑' : 'Tampilkan Semua →'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
