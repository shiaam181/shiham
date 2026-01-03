import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AttendancePhotoViewerProps {
  record: {
    id: string;
    employee_name?: string;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    check_in_photo_url: string | null;
    check_out_photo_url: string | null;
    check_in_latitude: number | null;
    check_in_longitude: number | null;
    check_out_latitude: number | null;
    check_out_longitude: number | null;
  };
  trigger: React.ReactNode;
}

export default function AttendancePhotoViewer({ record, trigger }: AttendancePhotoViewerProps) {
  const [checkInPhotoUrl, setCheckInPhotoUrl] = useState<string | null>(null);
  const [checkOutPhotoUrl, setCheckOutPhotoUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadSignedUrls = async () => {
    setIsLoading(true);
    try {
      // Load check-in photo
      if (record.check_in_photo_url) {
        // Check if it's already a full URL or a storage path
        if (record.check_in_photo_url.startsWith('http')) {
          setCheckInPhotoUrl(record.check_in_photo_url);
        } else {
          const { data, error } = await supabase.storage
            .from('employee-photos')
            .createSignedUrl(record.check_in_photo_url, 3600);
          
          if (data && !error) {
            setCheckInPhotoUrl(data.signedUrl);
          } else {
            console.error('Error getting check-in signed URL:', error);
          }
        }
      }

      // Load check-out photo
      if (record.check_out_photo_url) {
        if (record.check_out_photo_url.startsWith('http')) {
          setCheckOutPhotoUrl(record.check_out_photo_url);
        } else {
          const { data, error } = await supabase.storage
            .from('employee-photos')
            .createSignedUrl(record.check_out_photo_url, 3600);
          
          if (data && !error) {
            setCheckOutPhotoUrl(data.signedUrl);
          } else {
            console.error('Error getting check-out signed URL:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSignedUrls();
    }
  }, [isOpen, record.check_in_photo_url, record.check_out_photo_url]);

  const openMapLocation = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attendance Details</DialogTitle>
          <DialogDescription>
            {record.employee_name} - {record.date}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Check In Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-primary">Check In</h4>
            <div className="aspect-square rounded-lg border bg-muted/50 overflow-hidden flex items-center justify-center">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : checkInPhotoUrl ? (
                <img 
                  src={checkInPhotoUrl} 
                  alt="Check in" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-12 h-12" />
                  <span className="text-sm">No photo</span>
                </div>
              )}
            </div>
            <p className="text-sm font-medium">
              Time: {record.check_in_time 
                ? format(new Date(record.check_in_time), 'hh:mm a')
                : 'Not recorded'
              }
            </p>
            {record.check_in_latitude && record.check_in_longitude && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-primary hover:text-primary p-0 h-auto"
                onClick={() => openMapLocation(record.check_in_latitude, record.check_in_longitude)}
              >
                <MapPin className="w-4 h-4" />
                <span className="text-xs">
                  {record.check_in_latitude?.toFixed(5)}, {record.check_in_longitude?.toFixed(5)}
                </span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Check Out Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-primary">Check Out</h4>
            <div className="aspect-square rounded-lg border bg-muted/50 overflow-hidden flex items-center justify-center">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : checkOutPhotoUrl ? (
                <img 
                  src={checkOutPhotoUrl} 
                  alt="Check out" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-12 h-12" />
                  <span className="text-sm">No photo</span>
                </div>
              )}
            </div>
            <p className="text-sm font-medium">
              Time: {record.check_out_time 
                ? format(new Date(record.check_out_time), 'hh:mm a')
                : 'Not recorded'
              }
            </p>
            {record.check_out_latitude && record.check_out_longitude && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-primary hover:text-primary p-0 h-auto"
                onClick={() => openMapLocation(record.check_out_latitude, record.check_out_longitude)}
              >
                <MapPin className="w-4 h-4" />
                <span className="text-xs">
                  {record.check_out_latitude?.toFixed(5)}, {record.check_out_longitude?.toFixed(5)}
                </span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}