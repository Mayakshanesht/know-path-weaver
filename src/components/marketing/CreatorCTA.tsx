import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCircle2 } from 'lucide-react';

export default function CreatorCTA() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    // In production, this would send to a backend
    setSubmitted(true);
    toast({
      title: "You're on the list!",
      description: "We'll notify you when creator access opens.",
    });
  };

  return (
    <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bell className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-3xl font-bold mb-4">
            Want to create your own course?
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Use KnowGraph to structure and deliver your educational content.
          </p>

          {submitted ? (
            <motion.div
              className="flex items-center justify-center gap-2 text-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-medium">Thanks! We'll be in touch.</span>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit">
                <Bell className="w-4 h-4 mr-2" />
                Notify Me
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
