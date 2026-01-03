import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image as ImageIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PhotoThumbnailProps {
  photoUrl: string | null;
  alt: string;
  size?: 'sm' | 'md';
}

export default function PhotoThumbnail({ photoUrl, alt, size = 'sm' }: PhotoThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!photoUrl) {
        setImageUrl(null);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        // If it's already a full URL, use it directly
        if (photoUrl.startsWith('http')) {
          setImageUrl(photoUrl);
        } else {
          // Get signed URL from storage
          const { data, error } = await supabase.storage
            .from('employee-photos')
            .createSignedUrl(photoUrl, 3600);

          if (data && !error) {
            setImageUrl(data.signedUrl);
          } else {
            setHasError(true);
          }
        }
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [photoUrl]);

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (!photoUrl) {
    return (
      <div className={`${sizeClasses} rounded-md bg-muted flex items-center justify-center`}>
        <ImageIcon className="w-3 h-3 text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${sizeClasses} rounded-md bg-muted flex items-center justify-center`}>
        <div className="w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError || !imageUrl) {
    return (
      <div className={`${sizeClasses} rounded-md bg-destructive/10 flex items-center justify-center`}>
        <ImageIcon className="w-3 h-3 text-destructive" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${sizeClasses} rounded-md overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all`}>
            <img
              src={imageUrl}
              alt={alt}
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-0 overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt={alt}
            className="w-48 h-48 object-cover"
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
