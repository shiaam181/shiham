import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CountryCode {
  code: string;
  dial_code: string;
  name: string;
  flag: string;
}

export const countryCodes: CountryCode[] = [
  { code: 'IN', dial_code: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'US', dial_code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', dial_code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AE', dial_code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: 'SA', dial_code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AU', dial_code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', dial_code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', dial_code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', dial_code: '+33', name: 'France', flag: '🇫🇷' },
  { code: 'JP', dial_code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: 'SG', dial_code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: 'MY', dial_code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'PH', dial_code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: 'BD', dial_code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'PK', dial_code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'NP', dial_code: '+977', name: 'Nepal', flag: '🇳🇵' },
  { code: 'LK', dial_code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'CN', dial_code: '+86', name: 'China', flag: '🇨🇳' },
  { code: 'KR', dial_code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ID', dial_code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'TH', dial_code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', dial_code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'NZ', dial_code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'ZA', dial_code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'BR', dial_code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', dial_code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: 'IT', dial_code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', dial_code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', dial_code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', dial_code: '+46', name: 'Sweden', flag: '🇸🇪' },
];

interface CountryCodeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CountryCodeSelect({ value, onChange, disabled }: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);
  
  const selectedCountry = countryCodes.find(c => c.dial_code === value) || countryCodes[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[100px] justify-between px-2 font-normal bg-background"
        >
          <span className="flex items-center gap-1 truncate">
            <span>{selectedCountry.flag}</span>
            <span className="text-xs">{selectedCountry.dial_code}</span>
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-popover border border-border shadow-lg z-[100]" align="start">
        <Command className="bg-popover">
          <CommandInput placeholder="Search country..." className="h-9" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {countryCodes.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dial_code}`}
                  onSelect={() => {
                    onChange(country.dial_code);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <span className="mr-2">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-muted-foreground text-sm">{country.dial_code}</span>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === country.dial_code ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
