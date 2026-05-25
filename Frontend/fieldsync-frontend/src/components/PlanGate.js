import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function PlanGate({
  children,
  allow = [],
}) {
  const {
    loading,
    trialActive,
    plan,
    hasPremiumAccess,
  } = useAuth();

  if (loading) return null;

  if (!hasPremiumAccess) {
    return <Navigate to="/billing" replace />;
  }

  if (trialActive) {
    return children;
  }

  if (allow.includes(plan)) {
    return children;
  }

  return <Navigate to="/billing" replace />;
}