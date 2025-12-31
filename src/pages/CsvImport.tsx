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

const CsvImport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, data } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvData(data);
      setImportResult(null);

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
  };

  const transformValue = (value: string, type: string): unknown => {
    if (!value || value.trim() === "") return null;

    switch (type) {
      case "integer":
        return parseInt(value, 10) || 0;
      case "boolean":
        return value.toLowerCase() === "true" || value === "1";
      case "date":
        return value;
      case "timestamp":
        return new Date(value).toISOString();
      case "uuid":
        return value;
      default:
        return value;
    }
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
          errors.push(`Row ${i + 1}: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
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
              <CardDescription>Upload your CSV file to preview and import</CardDescription>
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
            <Button onClick={handleImport} disabled={isImporting} className="flex-1 md:flex-none">
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
