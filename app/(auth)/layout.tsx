export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-primary">Brew</span>metrics
          </h1>
          <p className="text-sm text-muted-foreground">Run your café on real numbers.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
