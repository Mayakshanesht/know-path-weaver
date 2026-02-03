import { motion } from 'framer-motion';
import { GitBranch, Lock, Play, BarChart3, Users, Globe } from 'lucide-react';

const features = [
  {
    icon: GitBranch,
    title: 'Graph-Based Learning',
    description: 'Navigate knowledge like a network. See how concepts connect and unlock new paths.',
  },
  {
    icon: Lock,
    title: 'Prerequisite System',
    description: 'Capsules unlock as you progress. Master fundamentals before advancing.',
  },
  {
    icon: Play,
    title: 'Capsule Lessons',
    description: 'Bite-sized learning units with video content directly from Google Drive.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description: 'Visual progress at every level. Track completion across capsules, modules, and courses.',
  },
  {
    icon: Users,
    title: 'Beta Community',
    description: 'Join our early adopters. Shape the platform with your feedback.',
  },
  {
    icon: Globe,
    title: 'Global Access',
    description: 'Flexible pricing for India and international students. Quality education for all.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold mb-4">Why KnowGraph?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A structured approach to learning that ensures you build knowledge the right way.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-lg transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
