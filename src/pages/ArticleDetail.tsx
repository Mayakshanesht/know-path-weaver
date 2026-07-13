import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/database';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Markdown } from '@/lib/markdown';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      setArticle((data as unknown as Article) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <article className="container mx-auto max-w-3xl px-4">
          <Link
            to="/articles"
            className="mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            All articles
          </Link>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !article ? (
            <div className="py-20 text-center">
              <h1 className="text-2xl font-semibold">Article not found</h1>
              <p className="mt-2 text-muted-foreground">
                It may have been unpublished, or the link is wrong.
              </p>
              <Button asChild className="mt-6">
                <Link to="/articles">Back to all articles</Link>
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <header className="mb-8 border-b pb-8">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {new Date(article.published_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {article.reading_minutes} min read
                  </span>
                </div>

                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                  {article.title}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                  {article.summary}
                </p>
              </header>

              <Markdown content={article.body} />

              {article.sources.length > 0 && (
                <section className="mt-12 rounded-2xl border bg-muted/30 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {article.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="group inline-flex items-start gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>{source.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="mt-8 text-xs text-muted-foreground">
                This article was drafted by an AI research assistant from the sources above.
                Go read the primary work before relying on any claim in it.
              </p>
            </motion.div>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}
