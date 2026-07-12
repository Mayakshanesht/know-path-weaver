import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Animated background nodes + SVG wave */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-40 h-40 rounded-full bg-gradient-to-br from-accent/10 to-primary/8 blur-2xl"
            style={{
              left: `${10 + i * 14}%`,
              top: `${10 + (i % 4) * 20}%`,
            }}
            animate={{
              y: [0, -18, 0],
              x: [0, (i % 2 === 0 ? -6 : 6), 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 6 + i,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}

        <motion.svg
          viewBox="0 0 1440 200"
          className="absolute bottom-0 left-0 w-full opacity-30"
          initial={{ y: 40 }}
          animate={{ y: 0 }}
          transition={{ duration: 1.2 }}
        >
          <path
            d="M0,80 C240,160 480,0 720,80 C960,160 1200,0 1440,80 L1440,200 L0,200 Z"
            fill="url(#g)"
          />
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--tw-gradient-stops, #7c3aed)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </motion.svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Graph-Based Learning Platform
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Learn Smarter with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              KnowGraph
            </span>
          </motion.h1>

          <motion.p
            className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Structured learning paths with prerequisite tracking. 
            Unlock knowledge step by step through our capsule-based curriculum.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button size="lg" asChild className="text-lg">
              <Link to="/courses">
                Explore Courses
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg">
              <Link to="/signup">Join Beta</Link>
            </Button>
          </motion.div>

          {/* Floating preview card */}
          <motion.div
            className="mt-12 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.div
              className="bg-gradient-to-br from-white/70 to-primary/5 border border-gray-200 rounded-xl shadow-2xl p-6 max-w-2xl w-full backdrop-blur"
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">KG</div>
                <div>
                  <div className="text-sm text-muted-foreground">Featured Course</div>
                  <div className="font-semibold text-xl">AI Bootcamp for Autonomous Driving</div>
                  <div className="text-sm text-muted-foreground mt-2">End-to-end AI stack — ML, GenAI, Perception, Planning. Final projects highlighted.</div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { value: '10+', label: 'Courses' },
              { value: '100+', label: 'Capsules' },
              { value: '500+', label: 'Students' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
