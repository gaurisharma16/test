import { ChangeEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  TrendingUp,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  Info,
} from "lucide-react";
import {
  useUploadFinancialDocument,
  useAnalyzeDocument,
  useFinancialAnalysisHistory,
  useGetDocumentAnalysis,
} from "@/hooks/useApi";
import type {
  AnalysisResult,
  EvaluationParameters,
  FinancialAnalysisRecord,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function formatDate(date: string | number | Date = new Date()) {
  return new Date(date).toLocaleString();
}

export default function FinancialData() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [expandedParameters, setExpandedParameters] = useState<Set<number>>(new Set([0]));
  const uploadMutation = useUploadFinancialDocument();
  const analyzeMutation = useAnalyzeDocument();
  const historyQuery = useFinancialAnalysisHistory(20);
  const selectedAnalysisQuery = useGetDocumentAnalysis(selectedAnalysisId ?? "");
  const { toast } = useToast();

  const history: FinancialAnalysisRecord[] = historyQuery.data ?? [];
  const activeAnalysis = selectedAnalysisQuery.data ?? currentAnalysis;
  const activeFileId = activeAnalysis?.file_id ?? selectedAnalysisId ?? null;
  const selectedHistoryRecord = activeFileId
    ? history.find((record) => record.file_id === activeFileId)
    : undefined;
  const isProcessing = uploadMutation.isPending || analyzeMutation.isPending;
  const isAnalysisLoading = selectedAnalysisQuery.isFetching && !currentAnalysis;
  const parameterEntries: EvaluationParameters[] = activeAnalysis?.parameters
    ? Array.isArray(activeAnalysis.parameters)
      ? activeAnalysis.parameters
      : [activeAnalysis.parameters]
    : [];
  const shouldShowAnalysisCard = Boolean(activeAnalysis) || isAnalysisLoading;

  const handleHistorySelect = (fileId: string) => {
    setSelectedAnalysisId(fileId);
    setCurrentAnalysis((prev) => (prev?.file_id === fileId ? prev : null));
    setExpandedParameters(new Set([0]));
  };

  const toggleParameter = (index: number) => {
    setExpandedParameters((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedAnalysisId && history.length > 0) {
      setSelectedAnalysisId(history[0].file_id);
    }
  }, [selectedAnalysisId, history]);

  useEffect(() => {
    if (
      selectedAnalysisQuery.data &&
      currentAnalysis?.file_id === selectedAnalysisQuery.data.file_id
    ) {
      setCurrentAnalysis(null);
    }
  }, [selectedAnalysisQuery.data, currentAnalysis]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setSelectedFileName(file ? file.name : null);
  };

  const resetFileInput = () => {
    setSelectedFile(null);
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please choose a PDF financial document to upload.",
      });
      return;
    }

    try {
      const uploadResponse = await uploadMutation.mutateAsync(selectedFile);
      toast({
        title: "Upload successful",
        description: `${uploadResponse.filename} uploaded. Starting analysis...`,
      });

      const analysisResponse = await analyzeMutation.mutateAsync(
        uploadResponse.file_id
      );

      setCurrentAnalysis(analysisResponse);
      setSelectedAnalysisId(analysisResponse.file_id);
      await historyQuery.refetch();
      toast({
        title: "Analysis ready",
        description: "The financial report summary has been generated.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Analysis failed",
        description:
          error instanceof Error ? error.message : "Unable to analyze document.",
      });
    } finally {
      resetFileInput();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Data Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Upload financial documents and extract key insights with AI-powered analysis
            </p>
          </div>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-primary" />
            <span>Upload and Analyze Document</span>
          </CardTitle>
          <CardDescription>
            Support for PDF files containing financial reports, 10-K, 10-Q, and investor presentations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center space-y-4 transition-colors hover:border-primary/50 hover:bg-muted/30">
            <div className="inline-flex p-4 rounded-full bg-primary/10">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">
                Drag and drop a PDF or use the button below
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                PDF documents up to 50MB • Instant AI analysis
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-3">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing}
                size="lg"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
              {selectedFileName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {selectedFileName}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  No file selected
                </span>
              )}
            </div>
            <Button
              className="w-full md:w-auto mt-2"
              onClick={handleProcessDocument}
              disabled={isProcessing || !selectedFile}
              size="lg"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Upload & Analyze
                </span>
              )}
            </Button>
          </div>

          {uploadMutation.isError && (
            <div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : "File upload failed."}
              </span>
            </div>
          )}
          {analyzeMutation.isError && (
            <div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {analyzeMutation.error instanceof Error
                  ? analyzeMutation.error.message
                  : "Analysis failed."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {shouldShowAnalysisCard && (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Analysis Results</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {selectedHistoryRecord
                    ? `Updated ${formatDate(selectedHistoryRecord.updated_at ?? selectedHistoryRecord.created_at)}`
                    : `Processed ${formatDate()}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {parameterEntries.length > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {parameterEntries.length} {parameterEntries.length === 1 ? 'Parameter' : 'Parameters'}
                  </Badge>
                )}
                <Badge variant="secondary" className="flex items-center gap-1">
                  {isAnalysisLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  {(selectedHistoryRecord?.status ?? activeAnalysis?.status ?? "pending")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isAnalysisLoading && !activeAnalysis ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analysis details...
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Document</span>
                  </div>
                  <div className="rounded-lg border-2 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                    <p className="text-sm font-semibold text-foreground mb-3">
                      {activeAnalysis?.filename}
                    </p>
                    <Separator className="mb-3" />
                    <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed text-sm text-foreground/90">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {activeAnalysis?.summary ?? "No summary generated for this document."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                {parameterEntries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Key Financial Parameters</span>
                    </div>
                    <div className="space-y-3">
                      {parameterEntries.map((parameter, index) => {
                        const isExpanded = expandedParameters.has(index);
                        return (
                          <div
                            key={`${parameter.parameter_name}-${index}`}
                            className="rounded-lg border-2 bg-card transition-all hover:shadow-md overflow-hidden"
                          >
                            <button
                              onClick={() => toggleParameter(index)}
                              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <h4 className="font-semibold text-foreground">{parameter.parameter_name}</h4>
                                </div>
                                {!isExpanded && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {parameter.definition}
                                  </p>
                                )}
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 space-y-4 border-t bg-muted/20">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Importance</p>
                                    <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {parameter.importance}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interpretation</p>
                                    <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {parameter.interpretation}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                                <Separator />
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Definition</p>
                                  <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                      {parameter.definition}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                                {parameter.benchmark_or_note && (
                                  <>
                                    <Separator />
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Benchmark / Note</p>
                                      <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                          {parameter.benchmark_or_note}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Download report
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Analysis History
          </CardTitle>
          <CardDescription>
            View and select from your previously analyzed documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isError ? (
            <p className="text-sm text-destructive">
              {historyQuery.error instanceof Error
                ? historyQuery.error.message
                : "Unable to load analysis history."}
            </p>
          ) : historyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading analysis history...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Upload a PDF to view your analysis history.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((analysis) => {
                  const isSelected = selectedAnalysisId === analysis.file_id;
                  const updatedAt = analysis.updated_at ?? analysis.created_at;
                  const summary = analysis.summary ?? "No summary available";
                  return (
                    <TableRow
                      key={analysis.file_id}
                      className={`${
                        isSelected ? "bg-primary/10 border-l-4 border-l-primary" : ""
                      } cursor-pointer hover:bg-muted/50 transition-colors`}
                      onClick={() => handleHistorySelect(analysis.file_id)}
                    >
                      <TableCell className="font-medium">{analysis.filename}</TableCell>
                      <TableCell>
                        <Badge variant={isSelected ? "secondary" : "outline"}>
                          {analysis.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {updatedAt ? formatDate(updatedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {summary.length > 160 ? `${summary.slice(0, 157)}…` : summary}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!shouldShowAnalysisCard && history.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What to expect from an analysis?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Upload a PDF 10-K, 10-Q or investor presentation to get an AI-generated summary and key parameter interpretation. Results will appear here once the analysis completes.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-muted/20">
                <p className="font-medium text-foreground mb-1">Key highlights</p>
                <p>
                  Revenue trends, profitability metrics, risk commentary and other financial insights are extracted automatically.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <p className="font-medium text-foreground mb-1">Compliance ready</p>
                <p>
                  Download the generated summary and parameter notes to accelerate internal reviews and client updates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}