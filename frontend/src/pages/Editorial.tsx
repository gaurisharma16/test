import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PenTool,
  CheckCircle,
  Lightbulb,
  FileText,
  Loader2,
  BookOpen,
  ClipboardList,
  Sparkles,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import {
  useStyleGuide,
  useEditorialAnalytics,
  useEditorialContext,
} from "@/hooks/useApi";
import {
  editorialApi,
  type EditorialSuggestion,
  type EditorialContextArticle,
  type EditorialContextReport,
  type EditorialContextFiling,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type ContentTypeOption = {
  value: string;
  label: string;
};

const contentTypes: ContentTypeOption[] = [
  { value: "article", label: "Market article" },
  { value: "headline", label: "Headline" },
  { value: "summary", label: "Executive summary" },
];

type ToneOption = {
  value: string;
  label: string;
};

const toneOptions: ToneOption[] = [
  { value: "Professional and informative", label: "Professional & informative" },
  { value: "Confident and concise", label: "Confident & concise" },
  { value: "Optimistic and motivational", label: "Optimistic & motivational" },
  { value: "Cautious and risk-aware", label: "Cautious & risk-aware" },
  { value: "custom", label: "Custom tone" },
];

const suggestionToneOptions = toneOptions.filter((option) => option.value !== "custom");
const SUGGESTION_TONE_NONE = "none";

function renderGuidelineValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${nestedValue}`)
      .join("; ");
  }
  return String(value ?? "");
}

export default function Editorial() {
  const { toast } = useToast();
  const { data: styleGuideData, isLoading: styleGuideLoading, error: styleGuideError } =
    useStyleGuide();
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useEditorialAnalytics();
  const {
    data: contextData,
    isLoading: contextLoading,
    error: contextError,
    refetch: refetchContext,
  } = useEditorialContext();

  const [text, setText] = useState(
    "Markets rallied today as investors reacted to stronger-than-expected earnings across the tech sector."
  );
  const [contentType, setContentType] = useState<string>(contentTypes[0]?.value ?? "article");
  const [suggestionToneValue, setSuggestionToneValue] = useState<string>(SUGGESTION_TONE_NONE);

  const [tonePreset, setTonePreset] = useState<string>(toneOptions[0]?.value ?? "Professional and informative");
  const [customTone, setCustomTone] = useState<string>("");
  const [marketSummary, setMarketSummary] = useState<string>("");
  const [customContext, setCustomContext] = useState<string>("");
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [selectedFilingIds, setSelectedFilingIds] = useState<string[]>([]);
  const marketPrefillRef = useRef(false);

  useEffect(() => {
    if (!marketPrefillRef.current && !marketSummary.trim() && contextData?.market_brief) {
      setMarketSummary(contextData.market_brief);
      marketPrefillRef.current = true;
    }
  }, [contextData, marketSummary]);

  const suggestionMutation = useMutation({
    mutationFn: async (payload: { text: string; contentType: string; tone?: string }) =>
      editorialApi.getSuggestions(payload.text, payload.contentType, payload.tone),
    onSuccess: (data) => {
      toast({ title: "Suggestions generated", description: `Received ${data.suggestions.length} ideas.` });
    },
    onError: (error) => {
      toast({
        title: "Unable to generate suggestions",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      toast({
        title: "Add some text first",
        description: "Please provide content for the assistant to review.",
        variant: "destructive",
      });
      return;
    }
    const toneToSend = suggestionToneValue !== SUGGESTION_TONE_NONE ? suggestionToneValue : undefined;
    suggestionMutation.mutate({ text, contentType, tone: toneToSend });
  };

  const suggestionData: EditorialSuggestion | undefined = suggestionMutation.data;
  const guidelines = styleGuideData?.guidelines ?? {};
  const analytics = analyticsData?.analytics;

  const draftMutation = useMutation({
    mutationFn: async (payload: {
      market_summary: string;
      reports: string[];
      market_filings: string[];
      articles: string[];
      additional_context: string[];
      tone: string;
    }) => editorialApi.generateDraft(payload),
    onSuccess: () => {
      toast({ title: "Draft generated", description: "Editorial article ready for review." });
    },
    onError: (error) => {
      toast({
        title: "Unable to generate draft",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const articlesMap = useMemo(() => {
    if (!contextData?.articles) {
      return new Map<string, EditorialContextArticle>();
    }
    return new Map(contextData.articles.map((item) => [item.id, item]));
  }, [contextData]);

  const reportsMap = useMemo(() => {
    if (!contextData?.reports) {
      return new Map<string, EditorialContextReport>();
    }
    return new Map(contextData.reports.map((item) => [item.id, item]));
  }, [contextData]);

  const filingsMap = useMemo(() => {
    if (!contextData?.filings) {
      return new Map<string, EditorialContextFiling>();
    }
    return new Map(contextData.filings.map((item) => [item.id, item]));
  }, [contextData]);

  const resolvedTone = tonePreset === "custom" ? (customTone.trim() || "Custom analyst voice") : tonePreset;

  const convertArticleToHighlight = (article: EditorialContextArticle | undefined) => {
    if (!article) return null;
    const sourceLabel = article.source ? ` (${article.source})` : "";
    const tags = article.tags && article.tags.length > 0 ? ` | Tags: ${article.tags.slice(0, 3).join(", ")}` : "";
    return `${article.title}${sourceLabel} – ${article.summary}${tags}`.trim();
  };

  const convertReportToHighlight = (report: EditorialContextReport | undefined) => {
    if (!report) return null;
    const highlight = report.parameter_highlights?.[0];
    return highlight ? `${report.summary} | Focus: ${highlight}` : report.summary;
  };

  const convertFilingToHighlight = (filing: EditorialContextFiling | undefined) => {
    if (!filing) return null;
    const sourceLabel = filing.source ? ` (${filing.source})` : "";
    const notes = filing.notes ? ` – ${filing.notes}` : "";
    return `${filing.title}${sourceLabel}${notes}`.trim();
  };

  const handleSelectionUpdate = (
    id: string,
    checked: boolean | "indeterminate",
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const isChecked = checked === true;
    setSelected((prev) => {
      if (isChecked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((value) => value !== id);
    });
  };

  const handleDraftSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const articleHighlights = selectedArticleIds
      .map((id) => convertArticleToHighlight(articlesMap.get(id)))
      .filter((value): value is string => Boolean(value));

    const reportHighlights = selectedReportIds
      .map((id) => convertReportToHighlight(reportsMap.get(id)))
      .filter((value): value is string => Boolean(value));

    const filingHighlights = selectedFilingIds
      .map((id) => convertFilingToHighlight(filingsMap.get(id)))
      .filter((value): value is string => Boolean(value));

    const additionalContext = customContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (
      !marketSummary.trim() &&
      articleHighlights.length === 0 &&
      reportHighlights.length === 0 &&
      filingHighlights.length === 0 &&
      additionalContext.length === 0
    ) {
      toast({
        title: "Add market context",
        description: "Provide a market summary or select context sources before drafting.",
        variant: "destructive",
      });
      return;
    }

    draftMutation.mutate({
      market_summary: marketSummary.trim(),
      reports: reportHighlights,
      market_filings: filingHighlights,
      articles: articleHighlights,
      additional_context: additionalContext,
      tone: resolvedTone,
    });
  };

  const draftData = draftMutation.data;
  const contextTotals = contextData?.totals ?? { articles: 0, reports: 0, filings: 0 };
  const selectedCounts = {
    articles: selectedArticleIds.length,
    reports: selectedReportIds.length,
    filings: selectedFilingIds.length,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Editorial Assistant</h1>
        <p className="text-lg text-muted-foreground">
          Generate actionable suggestions, review house guidelines, and track content performance from a single workspace.
        </p>
      </div>

      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="style">Style guide</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-primary" />
                <span>Content improvement suggestions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                  <div className="space-y-2">
                    <label htmlFor="editorial-text" className="text-sm font-medium">
                      Draft text
                    </label>
                    <Textarea
                      id="editorial-text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={8}
                      placeholder="Paste content that needs polishing..."
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="content-type" className="text-sm font-medium">
                        Content type
                      </label>
                      <Select
                        value={contentType}
                        onValueChange={(value) => setContentType(value)}
                      >
                        <SelectTrigger id="content-type">
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                        <SelectContent>
                          {contentTypes.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="suggestion-tone" className="text-sm font-medium">
                        Tone preference
                      </label>
                      <Select
                        value={suggestionToneValue}
                        onValueChange={(value) => setSuggestionToneValue(value)}
                      >
                        <SelectTrigger id="suggestion-tone">
                          <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SUGGESTION_TONE_NONE}>No preference</SelectItem>
                          {suggestionToneOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="word-count" className="text-sm font-medium">
                        Word count
                      </label>
                      <Input
                        id="word-count"
                        value={text.trim() ? String(text.trim().split(/\s+/).length) : "0"}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={suggestionMutation.isPending} className="w-full md:w-auto">
                  {suggestionMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lightbulb className="mr-2 h-4 w-4" />
                  )}
                  {suggestionMutation.isPending ? "Analyzing..." : "Generate suggestions"}
                </Button>
              </form>

              {suggestionMutation.isError && (
                <Alert variant="destructive" className="mt-6">
                  <AlertTitle>Failed to fetch suggestions</AlertTitle>
                  <AlertDescription>
                    {suggestionMutation.error instanceof Error
                      ? suggestionMutation.error.message
                      : "Something went wrong calling the editorial service."}
                  </AlertDescription>
                </Alert>
              )}

              {suggestionData && suggestionData.suggestions.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                      Suggested improvements
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {suggestionData.suggestions.map((suggestion, index) => (
                      <div key={`${suggestion}-${index}`} className="rounded-lg border bg-card p-4 shadow-sm">
                        <p className="text-sm leading-relaxed">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                    <span className="text-xs text-muted-foreground">
                      Content type: <span className="font-medium">{suggestionData.content_type}</span>
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {suggestionData.suggestions.length} {suggestionData.suggestions.length === 1 ? 'suggestion' : 'suggestions'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <span>Editorial context</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1">
                  <FileText className="mr-1.5 h-3 w-3" />
                  Articles: {contextTotals.articles}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <ClipboardList className="mr-1.5 h-3 w-3" />
                  Reports: {contextTotals.reports}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <BookOpen className="mr-1.5 h-3 w-3" />
                  Filings: {contextTotals.filings}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => refetchContext()}
                  disabled={contextLoading}
                  className="ml-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${contextLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {contextError ? (
                <Alert variant="destructive">
                  <AlertTitle>Context unavailable</AlertTitle>
                  <AlertDescription>
                    {(contextError as Error).message || "The backend did not return context data."}
                  </AlertDescription>
                </Alert>
              ) : contextLoading ? (
                <p className="text-sm text-muted-foreground">Loading contextual data...</p>
              ) : !contextData || (
                  contextData.articles.length === 0 &&
                  contextData.reports.length === 0 &&
                  contextData.filings.length === 0
                ) ? (
                <p className="text-sm text-muted-foreground">No contextual data saved yet.</p>
              ) : (
                <div className="space-y-6">
                  {contextData.market_brief && (
                    <Alert className="border-primary/50 bg-primary/5">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      <AlertTitle>Suggested market brief</AlertTitle>
                      <AlertDescription className="text-sm">{contextData.market_brief}</AlertDescription>
                    </Alert>
                  )}

                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent articles
                      </h3>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {contextData.articles.map((article) => (
                        <div key={article.id} className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                          <Checkbox
                            checked={selectedArticleIds.includes(article.id)}
                            onCheckedChange={(checked) =>
                              handleSelectionUpdate(article.id, checked, setSelectedArticleIds)
                            }
                            aria-label={`Select article ${article.title}`}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium leading-tight">{article.title}</span>
                              {article.source && <Badge variant="outline" className="text-xs">{article.source}</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
                            {article.publish_date && (
                              <p className="text-xs text-muted-foreground">Published: {article.publish_date}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedCounts.articles > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Selected article insights: {selectedCounts.articles}
                      </p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Saved report analysis
                      </h3>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {contextData.reports.map((report) => (
                        <div key={report.id} className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                          <Checkbox
                            checked={selectedReportIds.includes(report.id)}
                            onCheckedChange={(checked) =>
                              handleSelectionUpdate(report.id, checked, setSelectedReportIds)
                            }
                            aria-label="Select report highlight"
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <span className="text-sm font-medium leading-tight">{report.summary}</span>
                            {report.parameter_highlights.length > 0 && (
                              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                {report.parameter_highlights.map((highlight, index) => (
                                  <li key={`${report.id}-highlight-${index}`}>{highlight}</li>
                                ))}
                              </ul>
                            )}
                            {report.created_at && (
                              <p className="text-xs text-muted-foreground">Captured: {report.created_at}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedCounts.reports > 0 && (
                      <p className="text-xs text-muted-foreground">Selected report highlights: {selectedCounts.reports}</p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Regulatory filings
                      </h3>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {contextData.filings.map((filing) => (
                        <div key={filing.id} className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                          <Checkbox
                            checked={selectedFilingIds.includes(filing.id)}
                            onCheckedChange={(checked) =>
                              handleSelectionUpdate(filing.id, checked, setSelectedFilingIds)
                            }
                            aria-label={`Select filing ${filing.title}`}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium leading-tight">{filing.title}</span>
                              {filing.source && <Badge variant="outline" className="text-xs">{filing.source}</Badge>}
                            </div>
                            {filing.notes && (
                              <p className="text-sm text-muted-foreground leading-relaxed">{filing.notes}</p>
                            )}
                            {filing.filed_at && (
                              <p className="text-xs text-muted-foreground">Filed: {filing.filed_at}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedCounts.filings > 0 && (
                      <p className="text-xs text-muted-foreground">Selected filing callouts: {selectedCounts.filings}</p>
                    )}
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="style">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>House guidelines</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {styleGuideError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load style guide</AlertTitle>
                  <AlertDescription>
                    {(styleGuideError as Error).message || "The backend did not return guidelines."}
                  </AlertDescription>
                </Alert>
              ) : styleGuideLoading ? (
                <p className="text-sm text-muted-foreground">Fetching guidelines...</p>
              ) : Object.keys(guidelines).length === 0 ? (
                <p className="text-sm text-muted-foreground">No guidelines were provided by the API.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(guidelines).map(([key, value]) => (
                    <div key={key} className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</p>
                      <p className="text-sm leading-relaxed">{renderGuidelineValue(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <span>Editorial analytics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {analyticsError ? (
                <Alert variant="destructive">
                  <AlertTitle>Analytics unavailable</AlertTitle>
                  <AlertDescription>
                    {(analyticsError as Error).message || "Analytics endpoint returned an error."}
                  </AlertDescription>
                </Alert>
              ) : analyticsLoading ? (
                <p className="text-sm text-muted-foreground">Loading analytics...</p>
              ) : !analytics ? (
                <p className="text-sm text-muted-foreground">No analytics data available.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total articles tracked</span>
                      <Badge variant="secondary" className="text-base font-semibold">{analytics.total_articles}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Average engagement: <span className="font-medium">{analytics.average_engagement}</span>
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Top topics</span>
                    </div>
                    {analytics.top_topics.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">No trending topics identified.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {analytics.top_topics.map((topic: string) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Readability score</span>
                    </div>
                    <p className="text-2xl font-bold mt-3">{analytics.readability_score}</p>
                    <p className="text-xs text-muted-foreground mt-1">Higher scores indicate easier reading experience.</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Performance trends</span>
                    </div>
                    {analytics.performance_trends.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">No trend data yet.</p>
                    ) : (
                      <ul className="list-disc pl-5 text-xs mt-2 space-y-1">
                        {analytics.performance_trends.map((trend: string, index: number) => (
                          <li key={index}>{trend}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Generate full draft</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-6" onSubmit={handleDraftSubmit}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="market-summary" className="text-sm font-medium">
                      Market summary
                    </label>
                    <Textarea
                      id="market-summary"
                      value={marketSummary}
                      onChange={(event) => setMarketSummary(event.target.value)}
                      rows={6}
                      placeholder="Summarize the market tone, key drivers, or macro backdrop..."
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      This summary anchors the narrative. You can leave it blank if the context checklist has sufficient detail.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tone</label>
                      <Select value={tonePreset} onValueChange={(value) => setTonePreset(value)}>
                        <SelectTrigger id="tone-select">
                          <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                        <SelectContent>
                          {toneOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tonePreset === "custom" && (
                      <div className="space-y-2">
                        <label htmlFor="custom-tone" className="text-sm font-medium">
                          Describe custom tone
                        </label>
                        <Input
                          id="custom-tone"
                          value={customTone}
                          onChange={(event) => setCustomTone(event.target.value)}
                          placeholder="e.g., Balanced but urgent with emphasis on risk management"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label htmlFor="custom-context" className="text-sm font-medium">
                        Additional context
                      </label>
                      <Textarea
                        id="custom-context"
                        value={customContext}
                        onChange={(event) => setCustomContext(event.target.value)}
                        rows={4}
                        placeholder="Enter extra bullet points, one per line."
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use one idea per line. These will be passed to the assistant as additional talking points.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Selected context</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-primary" />
                          <span>{selectedCounts.articles}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ClipboardList className="h-3 w-3 text-primary" />
                          <span>{selectedCounts.reports}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3 text-primary" />
                          <span>{selectedCounts.filings}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={draftMutation.isPending}>
                    {draftMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {draftMutation.isPending ? "Drafting..." : "Generate draft"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tone applied: <span className="font-medium">{resolvedTone}</span>
                  </p>
                </div>
              </form>

              {draftMutation.isError && (
                <Alert variant="destructive">
                  <AlertTitle>Draft generation failed</AlertTitle>
                  <AlertDescription>
                    {draftMutation.error instanceof Error
                      ? draftMutation.error.message
                      : "Something went wrong calling the draft service."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {draftData && (
            <Card className="mt-6 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl font-bold leading-tight">{draftData.headline}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-lg text-muted-foreground leading-relaxed">{draftData.subheadline}</p>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-p:leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {draftData.article}
                  </ReactMarkdown>
                </div>

                {draftData.key_points.length > 0 && (
                  <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary" /> Key points
                    </h4>
                    <ul className="ml-6 list-disc space-y-2 text-sm">
                      {draftData.key_points.map((point, index) => (
                        <li key={`key-point-${index}`} className="leading-relaxed">{point}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {draftData.next_steps.length > 0 && (
                  <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                      <ClipboardList className="h-4 w-4 text-primary" /> Next steps
                    </h4>
                    <ul className="ml-6 list-disc space-y-2 text-sm">
                      {draftData.next_steps.map((step, index) => (
                        <li key={`next-step-${index}`} className="leading-relaxed">{step}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {draftData.data_callouts.length > 0 && (
                  <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                      <FileText className="h-4 w-4 text-primary" /> Data callouts
                    </h4>
                    <ul className="ml-6 list-disc space-y-2 text-sm">
                      {draftData.data_callouts.map((callout, index) => (
                        <li key={`data-callout-${index}`} className="leading-relaxed">{callout}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <AlertTitle className="text-amber-900 dark:text-amber-100">Risk disclaimer</AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm leading-relaxed">{draftData.risk_disclaimer}</AlertDescription>
                </Alert>

                {draftData.context_digest.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Context applied
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {draftData.context_digest.map((item, index) => (
                        <Badge key={`context-digest-${index}`} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}