import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'sky' | 'indigo' | 'blue' | 'teal' | 'purple' | 'emerald' | 'rose' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
  sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
  blue: 'bg-blue-50 text-blue-800 border-blue-200/80',
  teal: 'bg-teal-50 text-teal-800 border-teal-200/80',
  purple: 'bg-purple-50 text-purple-800 border-purple-200/80',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
  gray: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'teal',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm';
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-xs ${variantStyles[variant]} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
