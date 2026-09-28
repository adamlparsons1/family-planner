import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { CredentialsAdmin } from '@/components/CredentialsAdmin';

export default async function PasscodeAdminPage() {
  await requireParentPin('/admin/passcode');

  return (
    <AdminShell title="Passcode and PIN">
      <CredentialsAdmin />
    </AdminShell>
  );
}
