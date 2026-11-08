/**
 * Additive page-building primitives taken from the existing ErhaPay settings
 * and dashboard styles. Use when introducing NEW customer-facing screens.
 * The original screens are not refactored, and no financial state is derived here.
 */
import type { ReactNode } from 'react';
import BackButton from '@/components/Authentication/BackButton';
import { cn } from '@/lib/utils';

type CommonProps = { children: ReactNode; className?: string };

/** Matches the existing SettingsPage max-width and mobile-first spacing. */
export function ErhaPageFrame({ children, className }: CommonProps) {
  return <div className={cn('md:pt-5 max-w-[588px] mx-auto', className)}>{children}</div>;
}

/** Copies the existing SettingsPage heading, caption, and back navigation. */
export function ErhaPageHeading({
  title, description, backHref, className,
}: { title: string; description?: string; backHref?: string; className?: string }) {
  return (
    <header className={className}>
      {backHref ? <BackButton href={backHref} className="mb-10 md:mb-8 mt-2" /> : null}
      <h1 className="text-[#344054] md:text-[#112929] font-bold text-[28px]">{title}</h1>
      {description ? <p className="text-[#667085] text-sm">{description}</p> : null}
    </header>
  );
}

/** Matches the existing Settings/AccountSettings panel presentation. */
export function ErhaSettingsPanel({ children, className }: CommonProps) {
  return (
    <section className={cn('md:bg-white w-full rounded-[10px] md:border border-[#F0F2F5]', className)}>
      {children}
    </section>
  );
}
