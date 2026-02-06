import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  useEffect(() => {
    // When user clicks the email verification link, Supabase may redirect back with ?code=...
    // Exchange it for a session (no UI needed) and then clean the URL.
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    (async () => {
      await supabase.auth.exchangeCodeForSession(window.location.href);
      window.history.replaceState({}, document.title, '/');
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <motion.div
        className="max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to KnowGraph</h1>
          <p className="text-muted-foreground">
            Structured learning paths designed to take you from beginner to expert
          </p>
        </div>

        <div className="space-y-4">
          <Link to="/login">
            <Button size="lg" className="w-full">
              Sign In
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="lg" variant="outline" className="w-full">
              Sign Up
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
