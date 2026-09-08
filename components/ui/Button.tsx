import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const NON_COLOR_TEXT_SUFFIXES = new Set([
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'ellipsis',
  'clip',
  'truncate',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
]);

export function hasCustomTextColor(className: string): boolean {
  if (!className) return false;
  const tokens = className.trim().split(/\s+/);

  for (const rawToken of tokens) {
    const token = rawToken.replace(/^([a-z0-9-]+:)+/i, '');

    if (token.startsWith('text-')) {
      const suffix = token.slice(5);

      if (NON_COLOR_TEXT_SUFFIXES.has(suffix)) {
        continue;
      }

      if (/^\[\d+(?:\.\d+)?(?:px|rem|em|%)\]$/.test(suffix)) {
        continue;
      }

      return true;
    }
  }

  return false;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 active:scale-98 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 rounded-xl cursor-pointer';

  const hasCustomBg = /\bbg-/.test(className);
  const hasCustomText = hasCustomTextColor(className);

  const variants = {
    primary: `${hasCustomBg ? '' : 'bg-brand-primary hover:bg-brand-primary/90'} ${hasCustomText ? '' : 'text-white'} shadow-md hover:shadow-lg shadow-brand-primary/20 focus:ring-brand-primary`,
    secondary: `${hasCustomBg ? '' : 'bg-slate-900 hover:bg-slate-800'} ${hasCustomText ? '' : 'text-white'} shadow-md hover:shadow-lg shadow-slate-900/10 focus:ring-slate-800`,
    outline: `border border-slate-200 hover:border-brand-secondary ${hasCustomBg ? '' : 'bg-white hover:bg-brand-surface'} ${hasCustomText ? '' : 'text-slate-700 hover:text-brand-primary'} focus:ring-brand-primary`,
    ghost: `${hasCustomText ? '' : 'text-slate-600 hover:text-brand-primary'} ${hasCustomBg ? '' : 'hover:bg-brand-surface'} focus:ring-brand-primary`,
    danger: `${hasCustomBg ? '' : 'bg-rose-600 hover:bg-rose-700'} ${hasCustomText ? '' : 'text-white'} shadow-md shadow-rose-600/20 focus:ring-rose-500`,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs sm:text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
