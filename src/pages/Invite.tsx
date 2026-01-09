import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function Invite() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const trimmed = (code || "").trim();
    if (!trimmed) {
      navigate("/auth", { replace: true });
      return;
    }

    navigate(`/auth?invite=${encodeURIComponent(trimmed)}`, { replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
