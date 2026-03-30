import { ClipboardCheck, MapPin, Camera, Clock, ScanFace, Smartphone, BarChart3, Shield, Bell } from 'lucide-react';
import ProductPageLayout from './ProductPageLayout';

export default function AttendanceManagement() {
  return (
    <ProductPageLayout
      title="Attendance Management"
      tagline="Time & Attendance"
      description="Track employee attendance with GPS location, face verification, and photo proof. Real-time dashboards, overtime calculation, and seamless payroll integration — no hardware needed."
      heroIcon={ClipboardCheck}
      features={[
        { icon: MapPin, title: 'GPS-Based Punch In/Out', description: 'Employees punch in and out from their mobile with GPS coordinates captured automatically. Know exactly where attendance was marked.' },
        { icon: ScanFace, title: 'Face Verification', description: 'AI-powered face recognition ensures only the right employee can mark attendance. Prevents buddy punching completely.' },
        { icon: Camera, title: 'Photo Proof', description: 'Capture selfie photos during punch-in and punch-out. Photos are timestamped and stored for verification.' },
        { icon: Shield, title: 'Geofencing', description: 'Define office boundaries on a map. Attendance is flagged if marked from outside the geofence radius.' },
        { icon: Clock, title: 'Overtime Tracking', description: 'Automatically calculate overtime based on shift timings. Configurable overtime rules and rates.' },
        { icon: BarChart3, title: 'Attendance Reports', description: 'Daily, weekly, monthly attendance reports with late arrivals, early exits, and absence tracking.' },
        { icon: Smartphone, title: 'Live Location Tracking', description: 'Optional real-time location tracking during work hours for field teams. Privacy-compliant with employee consent.' },
        { icon: Bell, title: 'Auto Punch-Out', description: 'Automatic punch-out at shift end if employee forgets. No more incomplete attendance records.' },
        { icon: ClipboardCheck, title: 'Bulk Corrections', description: 'Admins can bulk-correct attendance entries, add admin notes, and view complete edit history.' },
      ]}
      howItWorks={[
        { step: 1, title: 'Set Up Shifts & Geofences', description: 'Define work shifts with start/end times, configure geofence locations on an interactive map, and set verification requirements.' },
        { step: 2, title: 'Employee Punches In', description: 'Employee opens the app, takes a selfie (if face verification enabled), and taps punch-in. GPS and timestamp are captured automatically.' },
        { step: 3, title: 'Real-Time Dashboard', description: 'Admins and managers see live attendance status — who\'s in, who\'s late, who\'s absent — on a single dashboard with map view.' },
        { step: 4, title: 'Auto Payroll Sync', description: 'Attendance data flows directly into payroll. Present days, overtime, and LOP are calculated without manual intervention.' },
      ]}
      benefits={[
        'Eliminate buddy punching with face recognition',
        'No expensive biometric hardware needed — works on any smartphone',
        'GPS + geofence + photo = triple verification for maximum accuracy',
        'Real-time visibility into workforce attendance across locations',
        'Overtime automatically calculated and synced to payroll',
        'Complete attendance history with photo proof for disputes',
        'Works offline — syncs when connectivity is restored',
        'Privacy-compliant with configurable tracking consent',
      ]}
    />
  );
}
