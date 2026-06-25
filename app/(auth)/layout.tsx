export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Romancham" className="mx-auto h-12 w-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Run your café on real numbers.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
