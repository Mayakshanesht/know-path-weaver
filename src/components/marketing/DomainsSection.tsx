import { motion } from 'framer-motion';
import { DOMAINS } from '@/data/courses';
import { Badge } from '@/components/ui/badge';

export default function DomainsSection() {
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-bold mb-2">Course Domains</h2>
          <p className="text-muted-foreground">Deep technical education across cutting-edge fields</p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {DOMAINS.map((domain, i) => (
            <Badge
              key={domain.name}
              variant="secondary"
              className="px-4 py-2 text-sm font-medium bg-card border border-border hover:bg-accent/10 transition-colors cursor-default"
            >
              <span className="mr-2">{domain.icon}</span>
              {domain.name}
            </Badge>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
