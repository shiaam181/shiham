import AppLayout from '@/components/AppLayout';
import LeaveRequestForm from '@/components/LeaveRequestForm';

export default function MyLeaves() {
  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <LeaveRequestForm />
      </main>
    </AppLayout>
  );
}
