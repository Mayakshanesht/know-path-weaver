import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Fetches a short-lived signed URL for an invoice PDF and opens it.
 *
 * The bucket is private, so there is no direct URL to link to; the edge function
 * checks the caller actually owns the invoice before it signs anything.
 */
export function useInvoiceDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const download = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      // A Vercel route, not a Supabase edge function: we have no CLI access to deploy
      // edge functions to this project, so that path 404s. This one also renders the
      // PDF on first download, which is what lets enrollments approved before
      // invoicing existed still produce one.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('Your session expired. Sign in again.');

      const response = await fetch('/api/invoice-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? `Download failed (${response.status})`);
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast({
        title: 'Could not download invoice',
        description: error.message ?? String(error),
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return { download, downloadingId };
}
