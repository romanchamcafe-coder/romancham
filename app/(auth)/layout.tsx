import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt="Romancham"
            width={183}
            height={48}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-2 text-sm text-muted-foreground">Run your café on real numbers.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
