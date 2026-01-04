import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground mb-4">Last updated: January 4, 2026</p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Welcome to our Attendance Management System. We respect your privacy and are committed 
              to protecting your personal data. This privacy policy explains how we collect, use, 
              and safeguard your information when you use our application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Email address, name, phone number, and profile photo</li>
              <li><strong>Attendance Data:</strong> Check-in/check-out times, location data, and attendance photos</li>
              <li><strong>Face Recognition Data:</strong> Facial embeddings for verification purposes (stored securely)</li>
              <li><strong>Device Information:</strong> Browser type, IP address, and device identifiers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain our attendance tracking service</li>
              <li>To verify your identity through face recognition</li>
              <li>To send you OTP codes for authentication</li>
              <li>To generate attendance reports and analytics</li>
              <li>To communicate with you about your account and updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption. We use Supabase 
              for data storage with Row Level Security (RLS) policies to ensure that users can 
              only access their own data. Face recognition data is encrypted and stored separately 
              from other personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Third-Party Services</h2>
            <p className="mb-2">We use the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Google Sign-In:</strong> For authentication (subject to Google's Privacy Policy)</li>
              <li><strong>EmailJS/Resend:</strong> For sending OTP emails</li>
              <li><strong>Twilio:</strong> For sending SMS OTP codes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide 
              you services. Attendance records are kept according to your organization's policies. 
              You can request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact your system 
              administrator or reach out through the application's support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
