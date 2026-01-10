import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Recover from links where "?" was encoded into the path (some chat apps do this)
    // Examples:
    // - /auth%3Finvite%3DXXXX
    // - /auth?invite=XXXX (if the "?" arrives in the pathname)
    const decodedPath = (() => {
      try {
        return decodeURIComponent(location.pathname);
      } catch {
        return location.pathname;
      }
    })();

    if (decodedPath.startsWith("/auth") && decodedPath.includes("?invite=")) {
      const tail = decodedPath.split("?invite=")[1] || "";
      const code = tail.match(/[A-Za-z0-9_-]{6,64}/)?.[0];
      if (code) {
        navigate(`/invite/${encodeURIComponent(code)}`, { replace: true });
        return;
      }
    }

    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
