import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HeroSection() {
  function CountUp({ value }: { value: string }) {
    const numeric = parseInt(String(value).replace(/\D/g, '') || '0', 10);
    const [count, setCount] = useState(0);

    useEffect(() => {
      let raf = 0;
      const duration = 900;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setCount(Math.floor(t * numeric));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [numeric]);

    return <span>{numeric > 0 ? (count === numeric ? `${numeric}${String(value).replace(/\d/g, '')}` : count) : value}</span>;
  }

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/6" />
      
      {/* Animated background nodes + SVG wave */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-44 h-44 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-accent/10 to-primary/12 blur-3xl"
            style={{
              left: `${10 + i * 14}%`,
              top: `${10 + (i % 4) * 20}%`,
            }}
            animate={{
              y: [0, -12 - (i % 3) * 6, 0],
              x: [0, (i % 2 === 0 ? -6 : 6), 0],
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 6 + i * 0.8,
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

        {/* Animated network overlay (lines + pulsing nodes) */}
        <motion.svg viewBox="0 0 1000 600" className="absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] opacity-40 pointer-events-none" preserveAspectRatio="xMidYMid meet">
          <g stroke="rgba(99,102,241,0.25)" strokeWidth="1">
            <line x1="100" y1="120" x2="300" y2="80" />
            <line x1="300" y1="80" x2="500" y2="140" />
            <line x1="500" y1="140" x2="700" y2="90" />
            <line x1="200" y1="220" x2="450" y2="180" />
            <line x1="650" y1="200" x2="820" y2="150" />
          </g>
          {[{x:100,y:120},{x:300,y:80},{x:500,y:140},{x:700,y:90},{x:200,y:220},{x:450,y:180},{x:650,y:200},{x:820,y:150}].map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={8}
              fill={i % 2 === 0 ? 'url(#nodeGradient)' : '#06b6d4'}
              initial={{ scale: 0.9, opacity: 0.8 }}
              animate={{ scale: [0.9, 1.2, 0.95], opacity: [0.8, 1, 0.85] }}
              transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
          <defs>
            <linearGradient id="nodeGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#06b6d4" />
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
              className="bg-gradient-to-br from-white/80 to-primary/6 border border-gray-100 rounded-2xl shadow-2xl p-6 max-w-2xl w-full backdrop-blur-lg hover:shadow-2xl group"
              whileHover={{ y: -8, scale: 1.02, rotate: 0.5 }}
              transition={{ type: 'spring', stiffness: 220 }}
            >
              <div className="flex items-start gap-4">
                <motion.div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg" whileHover={{ rotate: 6 }}>
                  KG
                </motion.div>
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
                        <div className="text-3xl font-bold text-primary"><CountUp value={stat.value} /></div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
