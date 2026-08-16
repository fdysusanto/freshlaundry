import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'white' | 'glass' | 'slate';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'white',
  className = '',
  ...props
}) => {
  const styles = {
    white: 'bg-white border border-slate-100 shadow-xl shadow-slate-200/50',
    glass: 'bg-white/80 backdrop-blur-md border border-white/60 shadow-xl shadow-teal-900/5',
    slate: 'bg-slate-900 text-white border border-slate-800 shadow-xl shadow-slate-950/20',
  };

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 transition-all duration-300 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
