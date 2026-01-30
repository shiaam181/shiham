import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Search, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface CompanySearchSelectProps {
  value: Company | null;
  onChange: (company: Company | null) => void;
  disabled?: boolean;
  error?: string;
}

export function CompanySearchSelect({ value, onChange, disabled, error }: CompanySearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search companies when query changes
  useEffect(() => {
    const searchCompanies = async () => {
      if (query.length < 1) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, logo_url")
          .eq("is_active", true)
          .ilike("name", `${query}%`)
          .order("name")
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        console.error("Error searching companies:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchCompanies, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (company: Company) => {
    onChange(company);
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative space-y-2 z-50">
      <Label htmlFor="company-search">
        Company <span className="text-destructive">*</span>
      </Label>

      {/* Selected company display */}
      {value ? (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
          {value.logo_url ? (
            <img
              src={value.logo_url}
              alt=""
              className="w-8 h-8 rounded object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <p className="font-medium text-sm">{value.name}</p>
            <p className="text-xs text-muted-foreground">Selected company</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="company-search"
            type="text"
            placeholder="Type to search your company..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
            className={cn("pl-10", error && "border-destructive")}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Dropdown results */}
      {isOpen && !value && query.length > 0 && (
        <div className="absolute left-0 right-0 z-[100] w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No companies found matching "{query}"
              <p className="text-xs mt-1">Make sure to type the correct company name</p>
            </div>
          ) : (
            <ul className="py-1">
              {results.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(company)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left transition-colors"
                  >
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt=""
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="font-medium text-sm">{company.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Start typing to search for your company. Your registration will require approval.
      </p>
    </div>
  );
}