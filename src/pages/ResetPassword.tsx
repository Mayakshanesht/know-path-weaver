import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import knowgraphLogo from '@/assets/knowgraph-logo.png';
import { usePasswordValidation } from '@/hooks/usePasswordValidation';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isValid } = usePasswordValidation(password);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if we have a valid session from reset link
    const checkSession = async () => {
      try {
        // Get the current hash fragment to check for reset tokens
        const hash = window.location.hash;
        const accessToken = new URLSearchParams(hash.substring(1)).get('access_token');
        
        if (!accessToken) {
          toast({
            title: 'Invalid or expired link',
            description: 'Please request a new password reset link.',
            variant: 'destructive',
          });
          navigate('/forgot-password');
          return;
        }

        // Verify the session is valid for password reset
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast({
            title: 'Invalid or expired link',
            description: 'Please request a new password reset link.',
            variant: 'destructive',
          });
          navigate('/forgot-password');
          return;
        }

        // Check if this is a password recovery session
        const { data: { user } } = await supabase.auth.getUser(accessToken);
        
        if (!user) {
          toast({
            title: 'Invalid session',
            description: 'Please request a new password reset link.',
            variant: 'destructive',
          });
          navigate('/forgot-password');
          return;
        }

        setIsValidToken(true);
        setCheckingToken(false);
      } catch (error) {
        console.error('Error validating reset token:', error);
        toast({
          title: 'Invalid or expired link',
          description: 'Please request a new password reset link.',
          variant: 'destructive',
        });
        navigate('/forgot-password');
      }
    };
    
    checkSession();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast({
        title: 'Weak password',
        description: 'Please meet all password requirements.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Sign out the user after successful password reset
        await supabase.auth.signOut();
        
        setSuccess(true);
        toast({
          title: 'Password updated!',
          description: 'Your password has been successfully reset. Please sign in with your new password.',
        });
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update password',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-xl border-border/50">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
              <p className="text-muted-foreground">Validating reset link...</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-xl border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-4">Invalid or expired reset link</p>
              <Button onClick={() => navigate('/forgot-password')}>
                Request New Link
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-border/50">
          <CardHeader className="text-center">
            <img src={knowgraphLogo} alt="KnowGraph" className="h-12 mx-auto mb-4" />
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>
              {success
                ? 'Your password has been reset'
                : 'Create a strong password for your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">
                  Redirecting to login...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !isValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
