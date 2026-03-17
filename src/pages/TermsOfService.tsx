import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
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

        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-muted-foreground mb-4">Last updated: January 4, 2026</p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Zentrek, you accept and agree to 
              be bound by these Terms of Service. If you do not agree to these terms, please do 
              not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p>
              This application provides attendance tracking and management services including:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Employee check-in and check-out functionality</li>
              <li>Face recognition verification</li>
              <li>Leave request management</li>
              <li>Attendance reporting and analytics</li>
              <li>Shift and schedule management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must notify us immediately of any unauthorized use of your account</li>
              <li>One person may not have multiple accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="mb-2">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use another person's account or attempt to impersonate others</li>
              <li>Manipulate attendance records or timestamps</li>
              <li>Use the face verification system with photos instead of live capture</li>
              <li>Attempt to bypass security measures or access unauthorized data</li>
              <li>Use the service for any illegal or unauthorized purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Face Recognition Consent</h2>
            <p>
              By using the face verification feature, you consent to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Having your facial data captured and processed for identity verification</li>
              <li>Storage of facial embeddings for future verification</li>
              <li>Photos being taken during check-in/check-out for audit purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Accuracy</h2>
            <p>
              You are responsible for ensuring the accuracy of your attendance records. Any 
              discrepancies should be reported to your administrator promptly. Falsification 
              of attendance records may result in disciplinary action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. 
              The service may be temporarily unavailable due to maintenance, updates, or 
              circumstances beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages resulting from your use 
              of or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the 
              service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact your system 
              administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
