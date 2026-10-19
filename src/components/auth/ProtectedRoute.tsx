import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { authUser, loading, userDataLoading, userDataError, retryUserData } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && userDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAdmin && userDataError) {
    return <main className="flex min-h-screen items-center justify-center p-6">
      <div role="alert" className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Account verification interrupted</h1>
        <p className="text-sm text-muted-foreground">{userDataError}</p>
        <p className="break-all text-xs text-muted-foreground">Signed in as {authUser.email}</p>
        <Button onClick={() => void retryUserData()}>Retry account verification</Button>
      </div>
    </main>;
  }

  if (requireAdmin && !authUser.isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
