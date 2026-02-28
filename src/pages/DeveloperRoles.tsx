import AppLayout from '@/components/AppLayout';
import RoleManagement from '@/components/RoleManagement';

export default function DeveloperRoles() {
  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6">
        <RoleManagement />
      </main>
    </AppLayout>
  );
}
