import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarPlus, ClipboardCheck, FileText, Clock, MessageSquare, Users } from 'lucide-react';

const ACTIONS = [
  { icon: ClipboardCheck, label: 'My Attendance', path: '/my-attendance', color: 'bg-primary/10 text-primary' },
  { icon: CalendarPlus, label: 'Apply Leave', path: '/my-leaves', color: 'bg-emerald-500/10 text-emerald-600' },
  { icon: FileText, label: 'My Payslips', path: '/my-payslips', color: 'bg-orange-500/10 text-orange-600' },
  { icon: Clock, label: 'My Journey', path: '/my-timeline', color: 'bg-purple-500/10 text-purple-600' },
  { icon: MessageSquare, label: 'Announcements', path: '/announcements', color: 'bg-sky-500/10 text-sky-600' },
  { icon: Users, label: 'Directory', path: '/directory', color: 'bg-pink-500/10 text-pink-600' },
];

export default function QuickActionsWidget() {
  const navigate = useNavigate();

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2.5 px-1">Quick Actions</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(action => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
