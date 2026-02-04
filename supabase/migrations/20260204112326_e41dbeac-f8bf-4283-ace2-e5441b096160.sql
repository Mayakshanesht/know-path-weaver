-- Create enum for content types
CREATE TYPE public.content_type AS ENUM (
  'google_drive',
  'youtube',
  'github',
  'colab',
  'weblink',
  'text',
  'image',
  'pdf'
);

-- Create capsule_content table for multiple content items per capsule
CREATE TABLE public.capsule_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capsule_id UUID NOT NULL REFERENCES public.capsules(id) ON DELETE CASCADE,
  content_type content_type NOT NULL,
  title TEXT,
  content_value TEXT NOT NULL, -- URL, file ID, or text content
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- For storing additional type-specific data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capsule_content ENABLE ROW LEVEL SECURITY;

-- Admins can manage capsule content
CREATE POLICY "Admins can manage capsule content"
ON public.capsule_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Capsule content is viewable for published courses or by admins
CREATE POLICY "Capsule content is viewable"
ON public.capsule_content
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM capsules cap
    JOIN learning_paths lp ON lp.id = cap.learning_path_id
    JOIN courses c ON c.id = lp.course_id
    WHERE cap.id = capsule_content.capsule_id
    AND (c.is_published = true OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_capsule_content_updated_at
BEFORE UPDATE ON public.capsule_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing drive file data to new content table
-- This preserves all existing capsule content
INSERT INTO public.capsule_content (capsule_id, content_type, title, content_value, metadata, order_index)
SELECT 
  id,
  'google_drive'::content_type,
  drive_file_name,
  drive_file_id,
  jsonb_build_object('file_type', drive_file_type),
  0
FROM public.capsules
WHERE drive_file_id IS NOT NULL AND drive_file_id != '';