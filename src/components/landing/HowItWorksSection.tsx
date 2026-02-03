import { motion } from 'framer-motion';
import { Search, CreditCard, Unlock, Play } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Browse Courses',
    description: 'Explore our catalog and find the perfect course for your learning goals.',
  },
  {
    icon: CreditCard,
    title: 'Enroll via Bank Transfer',
    description: 'Pay securely via bank transfer. Upload your receipt for quick approval.',
  },
  {
    icon: Unlock,
    title: 'Get Approved',
    description: 'Our team verifies your payment and grants you immediate course access.',
  },
  {
    icon: Play,
    title: 'Start Learning',
    description: 'Progress through capsules, unlock prerequisites, and track your journey.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get started in four simple steps
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-1/2" />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className={`relative flex items-center gap-8 mb-12 last:mb-0 ${
                  i % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                {/* Step number */}
                <div className="absolute left-8 md:left-1/2 w-8 h-8 -translate-x-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm z-10">
                  {i + 1}
                </div>

                {/* Content */}
                <div className={`flex-1 ml-16 md:ml-0 ${i % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                  <div className={`bg-card rounded-xl p-6 border border-border shadow-sm inline-block ${i % 2 === 0 ? 'md:ml-auto' : ''}`}>
                    <div className={`flex items-center gap-3 mb-2 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <step.icon className="w-5 h-5 text-accent" />
                      </div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>

                {/* Spacer for alternating layout */}
                <div className="hidden md:block flex-1" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
