import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CapsuleContent, ContentType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  FileVideo,
  Youtube,
  Github,
  Link,
  FileText,
  Image,
  FileType,
  ExternalLink,
  GripVertical,
  Upload,
} from 'lucide-react';
import { TiptapEditor } from '@/components/ui/tiptap-editor';

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string; description: string }> = {
  google_drive: { 
    label: 'Google Drive', 
    icon: FileVideo, 
    placeholder: 'Enter Google Drive file ID (videos, images, PDFs, documents)', 
    description: 'Upload any file type to Google Drive and share via file ID'
  },
  youtube: { 
    label: 'YouTube', 
    icon: Youtube, 
    placeholder: 'Enter YouTube video URL (e.g., https://youtube.com/watch?v=...)', 
    description: 'Embed YouTube videos directly in the course'
  },
  github: { 
    label: 'GitHub', 
    icon: Github, 
    placeholder: 'Enter GitHub repository or file URL', 
    description: 'Link to GitHub repositories, code files, or GitHub Pages'
  },
  colab: { 
    label: 'Google Colab', 
    icon: ExternalLink, 
    placeholder: 'Enter Colab notebook URL', 
    description: 'Interactive Jupyter notebooks for hands-on coding exercises'
  },
  weblink: { 
    label: 'Web Link', 
    icon: Link, 
    placeholder: 'Enter any website URL (e.g., https://example.com)', 
    description: 'Link to external websites, tools, or online resources'
  },
  text: { 
    label: 'Text/Notes', 
    icon: FileText, 
    placeholder: 'Enter text content or markdown', 
    description: 'Rich text content, code snippets, or study notes'
  },
  image: { 
    label: 'Image', 
    icon: Image, 
    placeholder: 'Enter image URL', 
    description: 'Diagrams, charts, or visual learning materials'
  },
  pdf: { 
    label: 'PDF', 
    icon: FileType, 
    placeholder: 'Enter PDF URL or Google Drive ID', 
    description: 'Documents, slides, or reference materials'
  },
};

interface CapsuleContentManagerProps {
  capsuleId: string;
  content: CapsuleContent[];
  onRefresh: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CapsuleContentManager({
  capsuleId,
  content,
  onRefresh,
  open,
  onOpenChange,
}: CapsuleContentManagerProps) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingContent, setEditingContent] = useState<CapsuleContent | null>(null);
  const [formData, setFormData] = useState({
    content_type: 'google_drive' as ContentType,
    title: '',
    content_value: '',
    description: '',
  });

  const resetForm = () => {
    setFormData({
      content_type: 'google_drive',
      title: '',
      content_value: '',
      description: '',
    });
    setEditingContent(null);
  };

  const handleSaveContent = async () => {
    if (!formData.content_value.trim()) {
      toast({
        title: 'Content value required',
        description: 'Please enter a URL, ID, or content.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingContent) {
        const { error } = await supabase
          .from('capsule_content')
          .update({
            content_type: formData.content_type,
            title: formData.title || null,
            content_value: formData.content_value,
            description: formData.description || null,
          })
          .eq('id', editingContent.id);

        if (error) throw error;
        toast({ title: 'Content updated!' });
      } else {
        const { error } = await supabase
          .from('capsule_content')
          .insert({
            capsule_id: capsuleId,
            content_type: formData.content_type,
            title: formData.title || null,
            content_value: formData.content_value,
            description: formData.description || null,
            order_index: content.length,
          });

        if (error) throw error;
        toast({ title: 'Content added!' });
      }

      resetForm();
      setAdding(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setSaving(false);
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Delete this content item?')) return;

    const { error } = await supabase
      .from('capsule_content')
      .delete()
      .eq('id', contentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Content deleted' });
      onRefresh();
    }
  };

  const handleReorderContent = async (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;

    const reorderedContent = [...content];
    const [draggedItem] = reorderedContent.splice(dragIndex, 1);
    reorderedContent.splice(dropIndex, 0, draggedItem);

    // Update order_index for all items individually
    try {
      for (let i = 0; i < reorderedContent.length; i++) {
        const { error } = await supabase
          .from('capsule_content')
          .update({ order_index: i })
          .eq('id', reorderedContent[i].id);
        
        if (error) throw error;
      }
      
      toast({ title: 'Content reordered' });
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `capsule-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('course-content')
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('course-content')
      .getPublicUrl(filePath);

    setFormData({ ...formData, content_value: publicUrl });
    toast({ title: 'Image uploaded successfully!' });
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('application/pdf')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file.',
        variant: 'destructive',
      });
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `capsule-pdfs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('course-content')
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('course-content')
      .getPublicUrl(filePath);

    setFormData({ ...formData, content_value: publicUrl });
    toast({ title: 'PDF uploaded successfully!' });
  };

  const openEdit = (item: CapsuleContent) => {
    setEditingContent(item);
    setFormData({
      content_type: item.content_type,
      title: item.title || '',
      content_value: item.content_value,
      description: item.description || '',
    });
    setAdding(true);
  };

  const config = CONTENT_TYPE_CONFIG[formData.content_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Capsule Content</DialogTitle>
          <DialogDescription>
            Add and manage content for this learning capsule including videos, documents, and links.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Content */}
          <div className="space-y-2">
            <Label>Content Items ({content.length})</Label>
              <div className="space-y-2">
                {content.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No content added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {content.map((item, index) => {
                      const typeConfig = CONTENT_TYPE_CONFIG[item.content_type];
                      const Icon = typeConfig.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg group"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {typeConfig.label}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {item.title || item.content_value}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteContent(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </div>

          {/* Add/Edit Form */}
          {adding ? (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">
                {editingContent ? 'Edit Content' : 'Add New Content'}
              </h4>

              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, content_type: value as ContentType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTENT_TYPE_CONFIG).map(([type, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <div>
                              <div className="font-medium">{cfg.label}</div>
                              <div className="text-xs text-muted-foreground">{cfg.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Display title"
                />
              </div>

              <div className="space-y-2">
                <Label>Content Value *</Label>
                {formData.content_type === 'text' ? (
                  <div className="space-y-2">
                    <TiptapEditor
                      content={formData.content_value}
                      onChange={(content) => setFormData({ ...formData, content_value: content })}
                      placeholder={config.placeholder}
                    />
                  </div>
                ) : formData.content_type === 'image' ? (
                  <div className="space-y-2">
                    <Input
                      value={formData.content_value}
                      onChange={(e) =>
                        setFormData({ ...formData, content_value: e.target.value })
                      }
                      placeholder="Google Drive File ID or upload below"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('image-upload')?.click()}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </Button>
                    </div>
                  </div>
                ) : formData.content_type === 'pdf' ? (
                  <div className="space-y-2">
                    <Input
                      value={formData.content_value}
                      onChange={(e) =>
                        setFormData({ ...formData, content_value: e.target.value })
                      }
                      placeholder="Google Drive File ID or upload below"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('pdf-upload')?.click()}
                        className="flex-1"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Input
                    value={formData.content_value}
                    onChange={(e) =>
                      setFormData({ ...formData, content_value: e.target.value })
                    }
                    placeholder={config.placeholder}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of this content"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveContent} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : editingContent ? (
                    'Update'
                  ) : (
                    'Add Content'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setAdding(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setAdding(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Content Item
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
