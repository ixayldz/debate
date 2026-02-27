import { BottomNav } from './bottom-nav';

export function MobileShell({
  title,
  children,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[450px] px-3 py-4">
      <div className="soft-card min-h-[86vh] p-3">
        <header className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <h1 className="font-display text-2xl tracking-tight">{title}</h1>
          <div>{rightAction}</div>
        </header>
        <main className="flex min-h-[68vh] flex-col gap-3">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
