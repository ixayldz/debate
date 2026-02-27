import { cn } from '@/lib/utils/cn';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-full border border-border bg-card px-4 py-3 text-sm outline-none',
        'focus:border-text/40 focus:ring-2 focus:ring-accent/50',
        props.className
      )}
    />
  );
}

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('pill-button w-full px-4 py-3 text-sm', className)} />;
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-[18px] border border-border bg-card p-3 shadow-card', className)}
    />
  );
}
