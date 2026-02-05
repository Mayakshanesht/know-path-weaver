import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Layers, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MarketingHero() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      
      {/* Graph pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="0.5" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Courses
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10">
            Structured, recorded learning — powered by{' '}
            <span className="text-primary font-semibold">KnowGraph</span> platform.
          </p>

          {/* Auth Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign Up
              </Button>
            </Link>
          </div>

          {/* Feature bullets */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <motion.div
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Layers className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm text-center">
                <span className="font-semibold text-foreground">Courses are made of Capsules</span>
                <br />
                <span className="text-muted-foreground">short, focused concepts</span>
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm text-center">
                <span className="font-semibold text-foreground">Capsules form learning paths</span>
                <br />
                <span className="text-muted-foreground">structured progression</span>
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Network className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm text-center">
                <span className="font-semibold text-foreground">Reusable knowledge graphs</span>
                <br />
                <span className="text-muted-foreground">connected understanding</span>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
