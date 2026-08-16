import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
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
  const hasCustomText = /\btext-/.test(className);

  const variants = {
    primary: `${hasCustomBg ? '' : 'bg-teal-600 hover:bg-teal-700'} ${hasCustomText ? '' : 'text-white'} shadow-md hover:shadow-lg shadow-teal-600/20 focus:ring-teal-500`,
    secondary: `${hasCustomBg ? '' : 'bg-slate-900 hover:bg-slate-800'} ${hasCustomText ? '' : 'text-white'} shadow-md hover:shadow-lg shadow-slate-900/10 focus:ring-slate-800`,
    outline: `border border-slate-200 hover:border-teal-500 ${hasCustomBg ? '' : 'bg-white hover:bg-teal-50/50'} ${hasCustomText ? '' : 'text-slate-700 hover:text-teal-700'} focus:ring-teal-500`,
    ghost: `${hasCustomText ? '' : 'text-slate-600 hover:text-teal-700'} ${hasCustomBg ? '' : 'hover:bg-teal-50/60'} focus:ring-teal-500`,
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
