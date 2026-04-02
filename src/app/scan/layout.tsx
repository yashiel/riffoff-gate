import { GateSSEProvider } from "@/providers/GateSSEProvider";
import { SessionProvider } from "@/providers/SessionProvider";

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GateSSEProvider>
      <SessionProvider>
        <div className="flex h-[100dvh] flex-col overflow-hidden">{children}</div>
      </SessionProvider>
    </GateSSEProvider>
  );
}
