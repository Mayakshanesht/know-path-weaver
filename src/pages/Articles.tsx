import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/database';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Clock, Newspaper } from 'lucide-react';

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      setArticles((data ?? []) as unknown as Article[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-bold sm:text-4xl">Research feed</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Daily write-ups of new work in autonomous driving and applied AI. Each one
              links the sources it was written from, so you can go read the primary work.
            </p>
          </motion.div>

          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed py-20 text-center">
              <Newspaper className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No articles yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                The first one appears once the daily generator has run.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                >
                  <Link
                    to={`/articles/${article.slug}`}
                    className="group block rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(article.published_at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {article.reading_minutes} min read
                      </span>
                      {article.sources.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {article.sources.length} source
                          {article.sources.length === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-xl font-semibold group-hover:text-primary">
                      {article.title}
                    </h2>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      {article.summary}
                    </p>

                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      Read article
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
