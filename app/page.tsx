export const dynamic = "force-dynamic";

import { AuthGate } from "@/components/auth/auth-gate";
import { HomeShell } from "@/components/dashboard/home-shell";

export default function HomePage() {
  return (
    <AuthGate>
      <HomeShell />
    </AuthGate>
  );
}
