import React from 'react';
import { Link } from 'react-router-dom';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`max-w-2xl space-y-3 ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <SectionLabel>{eyebrow}</SectionLabel>
      <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.6rem] font-semibold tracking-tight text-slate-900 leading-[1.15]">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-[15px] sm:text-base text-slate-600 leading-relaxed">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function FormalButton({
  href,
  children,
  variant = 'solid',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'solid' | 'outline' | 'onDark';
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center h-11 px-5 text-sm font-medium tracking-wide transition-colors rounded-md w-full sm:w-auto';
  const styles = variant === 'solid'
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : variant === 'onDark'
      ? 'bg-white text-slate-900 hover:bg-slate-100'
      : 'border border-slate-300 bg-transparent text-slate-800 hover:bg-white';
  const classes = `${base} ${styles} ${className}`;
  if (href.startsWith('/')) {
    return <Link to={href} className={classes}>{children}</Link>;
  }
  return <a href={href} className={classes}>{children}</a>;
}
