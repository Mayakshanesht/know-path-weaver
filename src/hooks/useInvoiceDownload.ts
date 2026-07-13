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
      const { data, error } = await supabase.functions.invoke('invoice-download', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? 'No download URL returned.');

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
