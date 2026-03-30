import { Target, BarChart3, Star, Users, Calendar, TrendingUp, FileText, Award, MessageSquare } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function PerformanceManagement() {
  return (
    <ProductPageLayout
      title="Performance Management"
      tagline="Goals & Reviews"
      description="Align individual goals with organizational objectives. Run structured review cycles, track KPIs, and build a culture of continuous feedback and growth."
      heroIcon={Target}
      features={[
        { icon: Target, title: 'Goal Setting & Tracking', description: 'Employees set quarterly and annual goals with measurable targets. Track progress with visual progress bars and status updates.' },
        { icon: BarChart3, title: 'KPI Scorecards', description: 'Define organization-wide KPIs and score employees against them. Weighted scoring with category-based breakdown.' },
        { icon: Star, title: 'Performance Reviews', description: 'Structured review forms with manager comments, ratings, strengths, improvement areas, and employee self-assessment.' },
        { icon: Calendar, title: 'Review Cycles', description: 'Create annual or quarterly review cycles. Track completion across the organization with progress dashboards.' },
        { icon: TrendingUp, title: 'Progress Visualization', description: 'Interactive charts showing goal completion rates, KPI trends over time, and team performance comparisons.' },
        { icon: Award, title: 'Awards & Recognition', description: 'Recognize top performers with awards. Track award history and celebrate achievements across the organization.' },
        { icon: MessageSquare, title: 'Feedback & Comments', description: 'Managers provide written feedback alongside ratings. Employees can acknowledge reviews and add their own comments.' },
        { icon: Users, title: 'Team Performance View', description: 'Managers see aggregated performance data for their team — average ratings, goal completion, and standout performers.' },
        { icon: FileText, title: 'Performance Reports', description: 'Generate detailed performance reports by individual, team, or department for talent review meetings.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Define KPIs & Goals', description: 'HR defines organization-wide KPIs. Managers and employees collaboratively set individual goals aligned with team objectives.' },
        { step: 2, title: 'Track Progress', description: 'Employees update goal progress regularly. Managers monitor completion rates and provide interim feedback through the platform.' },
        { step: 3, title: 'Run Review Cycles', description: 'At cycle end, managers complete structured review forms — rating performance, highlighting strengths, and suggesting improvements.' },
        { step: 4, title: 'Analyze & Act', description: 'HR gets organization-wide performance analytics. Identify high performers, training needs, and make informed promotion and compensation decisions.' },
      ]}
      benefits={[
        'Align individual goals with company strategy',
        'Data-driven performance decisions instead of guesswork',
        'Structured review process ensures consistency and fairness',
        'Employees get clear visibility into expectations and progress',
        'Historical performance data for career development planning',
        'Reduce bias with standardized KPI scoring',
        'Manager dashboards highlight team strengths and gaps',
        'Award system boosts employee morale and retention',
      ]}
    />
  );
}
