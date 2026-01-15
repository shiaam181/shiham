import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bug, CheckCircle, XCircle, AlertTriangle, Loader2, Copy, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DebugResult {
  step: string;
  status: "success" | "error" | "warning" | "pending";
  message: string;
  details?: string;
}

interface InviteDebugPanelProps {
  inviteCode: string | null;
  showQRCode?: boolean;
  onClose?: () => void;
}

export function InviteDebugPanel({ inviteCode, showQRCode = true, onClose }: InviteDebugPanelProps) {
  const [results, setResults] = useState<DebugResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const diagnostics: DebugResult[] = [];

    // Step 1: Check invite code format
    diagnostics.push({
      step: "Code Format",
      status: inviteCode && inviteCode.length >= 6 ? "success" : "error",
      message: inviteCode 
        ? `Code: "${inviteCode}" (${inviteCode.length} chars)`
        : "No invite code provided",
      details: inviteCode 
        ? `Valid format: ${/^[A-Za-z0-9_-]{6,64}$/.test(inviteCode) ? "Yes" : "No"}`
        : undefined,
    });
    setResults([...diagnostics]);

    if (!inviteCode || inviteCode.length < 6) {
      setIsRunning(false);
      return;
    }

    // Step 2: Call edge function
    diagnostics.push({
      step: "API Call",
      status: "pending",
      message: "Calling get-company-by-invite...",
    });
    setResults([...diagnostics]);

    try {
      const startTime = Date.now();
      const response = await supabase.functions.invoke("get-company-by-invite", {
        body: { inviteCode },
      });
      const duration = Date.now() - startTime;

      // Parse response
      let normalizedData = response.data;
      if (typeof normalizedData === "string") {
        try {
          normalizedData = JSON.parse(normalizedData);
        } catch {
          // keep as-is
        }
      }

      diagnostics[diagnostics.length - 1] = {
        step: "API Call",
        status: response.error ? "error" : "success",
        message: response.error 
          ? `Error: ${response.error.message}`
          : `Response received (${duration}ms)`,
        details: response.error 
          ? JSON.stringify(response.error, null, 2)
          : undefined,
      };
      setResults([...diagnostics]);

      // Step 3: Check response data
      if (!response.error) {
        if (normalizedData?.error) {
          diagnostics.push({
            step: "Validation",
            status: "error",
            message: normalizedData.error,
            details: `Raw response: ${JSON.stringify(normalizedData)}`,
          });
        } else if (normalizedData?.company?.id) {
          diagnostics.push({
            step: "Company Found",
            status: "success",
            message: `Company: ${normalizedData.company.name}`,
            details: `ID: ${normalizedData.company.id}`,
          });

          // Check invite info
          if (normalizedData.inviteInfo) {
            const info = normalizedData.inviteInfo;
            diagnostics.push({
              step: "Invite Info",
              status: info.remainingUses === 0 ? "warning" : "success",
              message: `Remaining uses: ${info.remainingUses ?? "Unlimited"}`,
              details: info.expiresAt 
                ? `Expires: ${new Date(info.expiresAt).toLocaleString()}`
                : "No expiry",
            });
          }
        } else {
          diagnostics.push({
            step: "Validation",
            status: "error",
            message: "Invalid response structure",
            details: JSON.stringify(normalizedData, null, 2),
          });
        }
      }
      setResults([...diagnostics]);

    } catch (err: any) {
      diagnostics[diagnostics.length - 1] = {
        step: "API Call",
        status: "error",
        message: `Network error: ${err.message}`,
        details: err.stack,
      };
      setResults([...diagnostics]);
    }

    setIsRunning(false);
  };

  const generateQR = async () => {
    if (!inviteCode) return;

    const link = `${window.location.origin}/invite/${encodeURIComponent(inviteCode)}`;

    // Use QR code API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
    setQrDataUrl(qrUrl);
  };

  const copyLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/invite/${encodeURIComponent(inviteCode)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

  const getStatusIcon = (status: DebugResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "pending":
        return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    }
  };

  return (
    <Card className="border-dashed border-yellow-500/50 bg-yellow-50/30 dark:bg-yellow-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Invite Debug Panel
          {onClose && (
            <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={onClose}>
              Hide
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current code info */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Current invite code:</div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
              {inviteCode || "(none)"}
            </code>
            {inviteCode && (
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            onClick={runDiagnostics} 
            disabled={isRunning || !inviteCode}
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bug className="w-3 h-3 mr-1" />}
            Run Diagnostics
          </Button>
          {showQRCode && inviteCode && (
            <Button variant="outline" size="sm" onClick={generateQR}>
              <QrCode className="w-3 h-3 mr-1" />
              Generate QR
            </Button>
          )}
        </div>

        {/* QR Code */}
        {qrDataUrl && (
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg">
            <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
            <p className="text-xs text-muted-foreground">Scan to open invite link</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium">Diagnostic Results:</div>
            {results.map((result, idx) => (
              <div key={idx} className="text-xs border rounded p-2 space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <Badge variant="outline" className="text-[10px]">{result.step}</Badge>
                  <span className="text-muted-foreground">{result.message}</span>
                </div>
                {result.details && (
                  <pre className="text-[10px] bg-muted/50 p-1 rounded overflow-auto max-h-20">
                    {result.details}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
