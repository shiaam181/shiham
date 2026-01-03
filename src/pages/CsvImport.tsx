import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

type TableConfig = {
  name: string;
  label: string;
  columns: { name: string; required: boolean; type: string }[];
};

const tableConfigs: TableConfig[] = [
  {
    name: "attendance",
    label: "Attendance",
    columns: [
      { name: "user_id", required: true, type: "uuid" },
      { name: "date", required: true, type: "date" },
      { name: "check_in_time", required: false, type: "timestamp" },
      { name: "check_out_time", required: false, type: "timestamp" },
      { name: "status", required: false, type: "text" },
      { name: "notes", required: false, type: "text" },
      { name: "overtime_minutes", required: false, type: "integer" },
    ],
  },
  {
    name: "profiles",
    label: "Profiles (Users)",
    columns: [
      { name: "user_id", required: true, type: "uuid" },
      { name: "email", required: true, type: "text" },
      { name: "full_name", required: true, type: "text" },
      { name: "phone", required: false, type: "text" },
      { name: "department", required: false, type: "text" },
      { name: "position", required: false, type: "text" },
      { name: "is_active", required: false, type: "boolean" },
    ],
  },
  {
    name: "holidays",
    label: "Holidays",
    columns: [
      { name: "name", required: true, type: "text" },
      { name: "date", required: true, type: "date" },
      { name: "description", required: false, type: "text" },
    ],
  },
  {
    name: "shifts",
    label: "Shifts",
    columns: [
      { name: "name", required: true, type: "text" },
      { name: "start_time", required: true, type: "time" },
      { name: "end_time", required: true, type: "time" },
      { name: "grace_period_minutes", required: false, type: "integer" },
      { name: "is_default", required: false, type: "boolean" },
    ],
  },
  {
    name: "leave_requests",
    label: "Leave Requests",
    columns: [
      { name: "user_id", required: true, type: "uuid" },
      { name: "start_date", required: true, type: "date" },
      { name: "end_date", required: true, type: "date" },
      { name: "leave_type", required: false, type: "text" },
      { name: "reason", required: false, type: "text" },
      { name: "status", required: false, type: "text" },
    ],
  },
  {
    name: "week_offs",
    label: "Week Offs",
    columns: [
      { name: "day_of_week", required: true, type: "integer" },
      { name: "is_global", required: false, type: "boolean" },
      { name: "user_id", required: false, type: "uuid" },
    ],
  },
];

// Zod schemas for each table - server-side style validation
const uuidSchema = z.string().uuid("Invalid UUID format").or(z.literal("").transform(() => undefined));
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").or(z.literal("").transform(() => undefined));
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format (HH:MM or HH:MM:SS)").or(z.literal("").transform(() => undefined));
const timestampSchema = z.string().refine((val) => {
  if (!val || val === "") return true;
  const date = new Date(val);
  return !isNaN(date.getTime());
}, "Invalid timestamp").or(z.literal("").transform(() => undefined));
const textSchema = z.string().max(1000, "Text too long (max 1000 chars)").or(z.literal("").transform(() => undefined));
const emailSchema = z.string().email("Invalid email").max(255, "Email too long").or(z.literal("").transform(() => undefined));
const integerSchema = z.string().refine((val) => {
  if (!val || val === "") return true;
  const num = parseInt(val, 10);
  return !isNaN(num) && num >= -2147483648 && num <= 2147483647;
}, "Invalid integer or out of range").or(z.literal("").transform(() => undefined));
const booleanSchema = z.string().refine((val) => {
  if (!val || val === "") return true;
  return ["true", "false", "1", "0", "yes", "no"].includes(val.toLowerCase());
}, "Invalid boolean (use true/false, 1/0, or yes/no)").or(z.literal("").transform(() => undefined));

// Table-specific schemas
const tableSchemas: Record<string, z.ZodObject<any>> = {
  attendance: z.object({
    user_id: uuidSchema.refine(val => val !== undefined, "user_id is required"),
    date: dateSchema.refine(val => val !== undefined, "date is required"),
    check_in_time: timestampSchema.optional(),
    check_out_time: timestampSchema.optional(),
    status: z.enum(["present", "absent", "late", "half_day", "on_leave", "holiday", "week_off"]).optional().or(z.literal("").transform(() => undefined)),
    notes: textSchema.optional(),
    overtime_minutes: integerSchema.optional(),
  }),
  profiles: z.object({
    user_id: uuidSchema.refine(val => val !== undefined, "user_id is required"),
    email: emailSchema.refine(val => val !== undefined, "email is required"),
    full_name: textSchema.refine(val => val !== undefined && val.length > 0, "full_name is required"),
    phone: z.string().regex(/^\+?[0-9\s\-()]{6,20}$/, "Invalid phone format").optional().or(z.literal("").transform(() => undefined)),
    department: textSchema.optional(),
    position: textSchema.optional(),
    is_active: booleanSchema.optional(),
  }),
  holidays: z.object({
    name: textSchema.refine(val => val !== undefined && val.length > 0, "name is required"),
    date: dateSchema.refine(val => val !== undefined, "date is required"),
    description: textSchema.optional(),
  }),
  shifts: z.object({
    name: textSchema.refine(val => val !== undefined && val.length > 0, "name is required"),
    start_time: timeSchema.refine(val => val !== undefined, "start_time is required"),
    end_time: timeSchema.refine(val => val !== undefined, "end_time is required"),
    grace_period_minutes: integerSchema.optional(),
    is_default: booleanSchema.optional(),
  }),
  leave_requests: z.object({
    user_id: uuidSchema.refine(val => val !== undefined, "user_id is required"),
    start_date: dateSchema.refine(val => val !== undefined, "start_date is required"),
    end_date: dateSchema.refine(val => val !== undefined, "end_date is required"),
    leave_type: z.enum(["casual", "sick", "earned", "unpaid", "maternity", "paternity", "other"]).optional().or(z.literal("").transform(() => undefined)),
    reason: textSchema.optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional().or(z.literal("").transform(() => undefined)),
  }),
  week_offs: z.object({
    day_of_week: integerSchema.refine(val => {
      if (val === undefined) return false;
      const num = parseInt(val as string, 10);
      return num >= 0 && num <= 6;
    }, "day_of_week must be 0-6 (Sunday-Saturday)"),
    is_global: booleanSchema.optional(),
    user_id: uuidSchema.optional(),
  }),
};

const CsvImport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ row: number; errors: string[] }[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  const selectedTableConfig = tableConfigs.find((t) => t.name === selectedTable);

  const parseCSV = (text: string): { headers: string[]; data: string[][] } => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const data = lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && !inQuotes) {
          inQuotes = true;
        } else if (char === '"' && inQuotes) {
          inQuotes = false;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });

    return { headers, data };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, data } = parseCSV(text);
      
      // Limit rows to 10000
      if (data.length > 10000) {
        toast.error("Too many rows. Maximum is 10,000 rows per import.");
        return;
      }
      
      setCsvHeaders(headers);
      setCsvData(data);
      setImportResult(null);
      setValidationErrors([]);

      // Auto-map columns based on name matching
      if (selectedTableConfig) {
        const autoMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
          const matchingColumn = selectedTableConfig.columns.find((col) => {
            const normalizedCol = col.name.toLowerCase().replace(/[_\s-]/g, "");
            return normalizedHeader === normalizedCol || normalizedHeader.includes(normalizedCol) || normalizedCol.includes(normalizedHeader);
          });
          if (matchingColumn) {
            autoMapping[header] = matchingColumn.name;
          }
        });
        setColumnMapping(autoMapping);
      }
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (csvColumn: string, tableColumn: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvColumn]: tableColumn === "skip" ? "" : tableColumn,
    }));
    setValidationErrors([]);
  };

  const transformValue = (value: string, type: string): unknown => {
    if (!value || value.trim() === "") return null;

    switch (type) {
      case "integer":
        const num = parseInt(value, 10);
        return isNaN(num) ? null : num;
      case "boolean":
        return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
      case "date":
        return value;
      case "timestamp":
        try {
          return new Date(value).toISOString();
        } catch {
          return null;
        }
      case "uuid":
        return value;
      default:
        // Sanitize text to prevent XSS
        return value.replace(/<[^>]*>/g, '').slice(0, 1000);
    }
  };

  const validateData = (): boolean => {
    if (!selectedTable || !tableSchemas[selectedTable]) {
      return false;
    }

    const schema = tableSchemas[selectedTable];
    const errors: { row: number; errors: string[] }[] = [];
    setIsValidating(true);

    csvData.forEach((row, rowIndex) => {
      const rawRecord: Record<string, string> = {};
      
      csvHeaders.forEach((header, index) => {
        const mappedColumn = columnMapping[header];
        if (mappedColumn) {
          rawRecord[mappedColumn] = row[index] || "";
        }
      });

      const result = schema.safeParse(rawRecord);
      if (!result.success) {
        const rowErrors = result.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );
        errors.push({ row: rowIndex + 1, errors: rowErrors });
      }
    });

    setValidationErrors(errors);
    setIsValidating(false);
    
    if (errors.length > 0) {
      toast.error(`Validation failed: ${errors.length} rows have errors`);
      return false;
    }
    
    return true;
  };

  const handleImport = async () => {
    if (!selectedTableConfig || csvData.length === 0) {
      toast.error("Please select a table and upload a CSV file");
      return;
    }

    // Check required columns are mapped
    const missingRequired = selectedTableConfig.columns
      .filter((col) => col.required)
      .filter((col) => !Object.values(columnMapping).includes(col.name));

    if (missingRequired.length > 0) {
      toast.error(`Missing required columns: ${missingRequired.map((c) => c.name).join(", ")}`);
      return;
    }

    // Validate all data first
    if (!validateData()) {
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const record: Record<string, unknown> = {};

      csvHeaders.forEach((header, index) => {
        const mappedColumn = columnMapping[header];
        if (mappedColumn) {
          const columnConfig = selectedTableConfig.columns.find((c) => c.name === mappedColumn);
          if (columnConfig) {
            record[mappedColumn] = transformValue(row[index] || "", columnConfig.type);
          }
        }
      });

      try {
        const { error } = await supabase.from(selectedTable as "attendance" | "profiles" | "holidays" | "shifts" | "leave_requests" | "week_offs").insert([record as never]);

        if (error) {
          // Sanitize error message to avoid leaking schema details
          const safeError = error.message.includes("duplicate key") 
            ? "Duplicate record"
            : error.message.includes("violates foreign key")
            ? "Referenced record not found"
            : "Import failed";
          errors.push(`Row ${i + 1}: ${safeError}`);
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: Import failed`);
      }
    }

    setImportResult({ success: successCount, errors });
    setIsImporting(false);

    if (errors.length === 0) {
      toast.success(`Successfully imported ${successCount} records`);
    } else if (successCount > 0) {
      toast.warning(`Imported ${successCount} records with ${errors.length} errors`);
    } else {
      toast.error(`Import failed with ${errors.length} errors`);
    }
  };

  const resetImport = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportResult(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/developer")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">CSV Import Tool</h1>
            <p className="text-muted-foreground">Import data from CSV files into your database tables</p>
          </div>
        </div>

        {/* Table Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Select Table
            </CardTitle>
            <CardDescription>Choose which table you want to import data into</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTable} onValueChange={(value) => { setSelectedTable(value); resetImport(); }}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select a table..." />
              </SelectTrigger>
              <SelectContent>
                {tableConfigs.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTableConfig && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Table Columns:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTableConfig.columns.map((col) => (
                    <Badge key={col.name} variant={col.required ? "default" : "secondary"}>
                      {col.name} ({col.type}){col.required && " *"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Upload */}
        {selectedTable && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV File
              </CardTitle>
              <CardDescription>Upload your CSV file (max 5MB, 10,000 rows)</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </CardContent>
          </Card>
        )}

        {/* Column Mapping */}
        {csvHeaders.length > 0 && selectedTableConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
              <CardDescription>Map your CSV columns to table columns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{header}</label>
                    <Select
                      value={columnMapping[header] || "skip"}
                      onValueChange={(value) => handleMappingChange(header, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">-- Skip --</SelectItem>
                        {selectedTableConfig.columns.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name} {col.required && "*"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation Errors</AlertTitle>
            <AlertDescription>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <ul className="text-sm list-disc list-inside">
                  {validationErrors.slice(0, 20).map((err, index) => (
                    <li key={index}>
                      Row {err.row}: {err.errors.join(", ")}
                    </li>
                  ))}
                  {validationErrors.length > 20 && (
                    <li>...and {validationErrors.length - 20} more rows with errors</li>
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Data Preview */}
        {csvData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>Showing first 10 rows of {csvData.length} total rows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {csvHeaders.map((header) => (
                        <TableHead key={header}>
                          {header}
                          {columnMapping[header] && (
                            <span className="block text-xs text-primary">→ {columnMapping[header]}</span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="max-w-[200px] truncate">
                            {cell || <span className="text-muted-foreground italic">empty</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Result */}
        {importResult && (
          <Alert variant={importResult.errors.length === 0 ? "default" : "destructive"}>
            {importResult.errors.length === 0 ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              Import {importResult.errors.length === 0 ? "Complete" : "Completed with Errors"}
            </AlertTitle>
            <AlertDescription>
              <p>Successfully imported {importResult.success} records</p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <p className="font-medium">Errors ({importResult.errors.length}):</p>
                  <ul className="text-sm list-disc list-inside">
                    {importResult.errors.slice(0, 20).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {importResult.errors.length > 20 && (
                      <li>...and {importResult.errors.length - 20} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {csvData.length > 0 && (
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={validateData} 
              disabled={isValidating || isImporting}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Validate Data
                </>
              )}
            </Button>
            <Button onClick={handleImport} disabled={isImporting || isValidating} className="flex-1 md:flex-none">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {csvData.length} Rows
                </>
              )}
            </Button>
            <Button variant="outline" onClick={resetImport}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvImport;
