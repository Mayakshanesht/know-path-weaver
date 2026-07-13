import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Clock } from 'lucide-react';

/**
 * The research feed on the home page.
 *
 * Renders nothing at all when there are no articles — an empty "Latest Research"
 * heading above a blank strip looks more broken than simply not being there.
 */
export default function ArticlesSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(3);

      setArticles((data ?? []) as unknown as Article[]);
      setLoading(false);
    })();
  }, []);

  if (!loading && articles.length === 0) return null;

  return (
    <section className="border-t border-white/5 bg-slate-950 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">
              Research feed
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              What moved this week
            </h2>
            <p className="mt-2 max-w-xl text-slate-400">
              Short, honest write-ups of new work in autonomous driving and applied AI —
              refreshed daily, with the sources so you can check them yourself.
            </p>
          </div>
          <Link
            to="/articles"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            All articles
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Link
                  to={`/articles/${article.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-6 transition-all hover:-translate-y-1 hover:border-sky-400/40 hover:bg-slate-900"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-sky-400/30 bg-sky-400/10 text-xs text-sky-300"
                    >
                      New
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {article.reading_minutes} min
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold leading-snug text-white group-hover:text-sky-300">
                    {article.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400 line-clamp-3">
                    {article.summary}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-400">
                    Read
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
