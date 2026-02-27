export default function PublicAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[450px] items-center justify-center px-4 py-6">
      <div className="soft-card w-full p-6">{children}</div>
    </div>
  );
}
