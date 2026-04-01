import { AuthGate } from "@/components/auth/auth-gate";
import { ProfileShell } from "@/components/dashboard/profile-shell";

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfileShell />
    </AuthGate>
  );
}
