import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	useScrapeArticles,
	useSavedArticles,
	useListFavorites,
	useAddFavorite,
	useRemoveFavorite,
} from "@/hooks/useApi";
import {
	FileText,
	Download,
	Save,
	Edit,
	Clock,
	TrendingUp,
	TrendingDown,
	Minus,
	CheckCircle,
	Globe,
	Search,
	Filter,
	ExternalLink,
	AlertCircle,
	RefreshCw,
	Loader2,
	Heart,
} from "lucide-react";

const dataSourcesConfig = [
	{
		id: 1,
		name: "Yahoo Finance",
		url: "finance.yahoo.com",
		type: "Financial Data",
		status: "active",
		lastUpdate: "5 minutes ago",
		dataPoints: ["Stock Prices", "Market News", "Analyst Ratings"],
	},
	{
		id: 2,
		name: "Bloomberg",
		url: "bloomberg.com",
		type: "Market News",
		status: "active",
		lastUpdate: "10 minutes ago",
		dataPoints: ["Breaking News", "Market Analysis", "Economic Data"],
	},
	{
		id: 3,
		name: "SEC EDGAR",
		url: "sec.gov/edgar",
		type: "Regulatory Filings",
		status: "active",
		lastUpdate: "30 minutes ago",
		dataPoints: ["10-K Reports", "10-Q Reports", "8-K Filings"],
	},
	{
		id: 4,
		name: "MarketWatch",
		url: "marketwatch.com",
		type: "Market Analysis",
		status: "active",
		lastUpdate: "15 minutes ago",
		dataPoints: ["Market Commentary", "Sector Analysis", "Earnings Reports"],
	},
	{
		id: 5,
		name: "Reuters",
		url: "reuters.com",
		type: "News & Analysis",
		status: "inactive",
		lastUpdate: "2 hours ago",
		dataPoints: ["Breaking News", "Company Updates", "Market Trends"],
	},
];

type PreparedArticle = {
	id: string;
	title: string;
	source: string;
	company: string;
	extractedAt: string;
	publishedAt: Date | null;
	sentiment: "positive" | "neutral" | "negative";
	status: string;
	url: string;
	summary: string;
	keyMetrics: Record<string, string>;
	keywords: string[];
	tags: string[];
	authors: string[];
	wordCount: number;
	dbId?: string | null;
};

const SOURCE_LOOKUP: Array<{ match: string; label: string; color: string }> = [
	{ match: "sec", label: "Regulatory", color: "bg-blue-500" },
	{ match: "bloomberg", label: "Premium", color: "bg-orange-500" },
	{ match: "reuters", label: "Wire", color: "bg-emerald-500" },
	{ match: "marketwatch", label: "Market", color: "bg-green-500" },
	{ match: "livemint", label: "Regional", color: "bg-amber-500" },
	{ match: "yahoo", label: "Public", color: "bg-purple-500" },
];

const DEFAULT_SOURCE_META = { label: "External", color: "bg-slate-400" };

function parseWebsiteInput(input: string): string[] {
	return input
		.split(/[\n,]+/)
		.map((value) => value.trim())
		.filter(Boolean);
}

function deriveSource(rawSource?: string | null, link?: string): string {
	if (rawSource && rawSource.trim().length > 0) {
		return rawSource.trim();
	}
	if (!link) {
		return "Unknown source";
	}
	try {
		const hostname = new URL(link).hostname.replace(/^www\./, "");
		return hostname || "Unknown source";
	} catch {
		return "Unknown source";
	}
}

function parsePublishDate(value?: string | null): {
	formatted: string;
	date: Date | null;
} {
	if (!value) {
		return { formatted: "Unknown publish date", date: null };
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return { formatted: value, date: null };
	}
	return { formatted: parsed.toLocaleString(), date: parsed };
}

function buildSummary(text?: string | null, maxLength: number = 220): string {
	if (!text) {
		return "No summary available.";
	}
	const cleaned = text.replace(/\s+/g, " ").trim();
	if (cleaned.length <= maxLength) {
		return cleaned;
	}
	return `${cleaned.slice(0, maxLength - 3)}...`;
}

function getSourceMeta(source: string) {
	const match = SOURCE_LOOKUP.find((entry) =>
		source.toLowerCase().includes(entry.match)
	);
	return match
		? { label: match.label, color: match.color }
		: DEFAULT_SOURCE_META;
}

export default function BrokerReports() {
	const [searchQuery, setSearchQuery] = useState("");
	const [countInput, setCountInput] = useState("5");
	const [maxArticlesInput, setMaxArticlesInput] = useState("60");
	const [websiteInput, setWebsiteInput] = useState("");
	const [selectedArticle, setSelectedArticle] =
		useState<PreparedArticle | null>(null);
	const [authToken, setAuthToken] = useState<string | null>(() =>
		typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
	);
	const [favoriteFeedback, setFavoriteFeedback] = useState<{
		type: "info" | "error" | "success";
		text: string;
	} | null>(null);
	const [scrapeParams, setScrapeParams] = useState({
		count: 5,
		maxArticles: 60,
		websites: [] as string[],
	});

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const syncToken = () => {
			setAuthToken(localStorage.getItem("auth_token"));
		};
		window.addEventListener("storage", syncToken);
		return () => window.removeEventListener("storage", syncToken);
	}, []);

	useEffect(() => {
		if (!favoriteFeedback || typeof window === "undefined") {
			return;
		}
		const timer = window.setTimeout(() => setFavoriteFeedback(null), 5000);
		return () => window.clearTimeout(timer);
	}, [favoriteFeedback]);

	const savedArticlesQuery = useSavedArticles(200, 0);
	const scrapeQuery = useScrapeArticles({ ...scrapeParams, enabled: false });

	// Favorites (only available when authenticated)
	const favoritesQuery = useListFavorites();
	const favoritesData = favoritesQuery.data?.favorites ?? [];
	const favoriteIds = new Set<string>(
		Array.isArray(favoritesData)
			? favoritesData
					.map((f: any) => {
						// The backend returns ArticleInDB objects in favorites list
						// We need to extract the _id field and convert to string
						const id = f._id || f.id;
						return typeof id === "object" && id !== null
							? String(id)
							: String(id || "");
					})
					.filter(Boolean)
			: []
	);
	const addFavoriteMutation = useAddFavorite();
	const removeFavoriteMutation = useRemoveFavorite();

	const isAuthenticated = Boolean(authToken);
	const {
		data: savedData,
		isLoading: savedLoading,
		isPending: savedPending,
		isFetching: savedFetching,
		isError: savedError,
		error: savedErrorObj,
		refetch: refetchSaved,
	} = savedArticlesQuery;
	const {
		data: scrapeData,
		isLoading: scrapeLoading,
		isPending: scrapePending,
		isFetching: scrapeFetching,
		isError: scrapeError,
		error: scrapeErrorObj,
		refetch: refetchScrape,
	} = scrapeQuery;

	// Use saved articles if available, otherwise use scraped articles
	// savedData is already an array, scrapeData.articles is also an array
	const articles =
		(savedData && Array.isArray(savedData) && savedData.length > 0
			? savedData
			: scrapeData?.articles) ?? [];
	const isLoading = savedLoading || scrapeLoading;
	const isPending = savedPending || scrapePending;
	const isFetching = savedFetching || scrapeFetching;
	const isError = savedError || scrapeError;
	const error = savedErrorObj || scrapeErrorObj;
	const refetch = refetchSaved;

	const filteredArticles = useMemo(() => {
		const term = searchQuery.trim().toLowerCase();
		if (!term) {
			return articles;
		}
		return articles.filter((article) => {
			const authorsList = article.authors || article.author || [];
			const haystacks = [
				article.title,
				article.text,
				article.source,
				Array.isArray(authorsList) ? authorsList.join(" ") : undefined,
				Array.isArray(article.keywords)
					? article.keywords.join(" ")
					: undefined,
				Array.isArray(article.tags) ? article.tags.join(" ") : undefined,
			];
			return haystacks.some((value) =>
				value ? value.toLowerCase().includes(term) : false
			);
		});
	}, [articles, searchQuery]);

	const preparedReports = useMemo<PreparedArticle[]>(() => {
		return filteredArticles.map((article, index) => {
			const source = deriveSource(article.source, article.link);
			const publishInfo = parsePublishDate(article.publish_date);
			// Handle both 'authors' and 'author' fields
			const authorsList = article.authors || article.author || [];
			const authors = Array.isArray(authorsList)
				? authorsList.filter(Boolean)
				: [];
			const keywords = Array.isArray(article.keywords)
				? article.keywords.filter(Boolean)
				: [];
			const tags = Array.isArray(article.tags)
				? article.tags.filter(Boolean)
				: [];
			const wordCount = article.text
				? article.text.trim().split(/\s+/).filter(Boolean).length
				: 0;
			const keyMetrics: Record<string, string> = {
				authors: authors.length ? authors.join(", ") : "Unknown authors",
				keywords: keywords.length
					? `${keywords.length} keywords`
					: "No keywords",
				tags: tags.length ? `${tags.length} tags` : "No tags",
			};

			// Extract and normalize the database ID
			const rawId = article._id || article.id;
			const dbId = rawId
				? typeof rawId === "object"
					? String(rawId)
					: String(rawId)
				: undefined;

			return {
				id: article.link || `article-${index}`,
				title: article.title || "Untitled",
				dbId,
				source,
				company: source,
				extractedAt: publishInfo.formatted,
				publishedAt: publishInfo.date,
				sentiment: "neutral",
				status: publishInfo.date ? "enriched" : "scraped",
				url: article.link || "#",
				summary: buildSummary(article.text),
				keyMetrics,
				keywords,
				tags,
				authors,
				wordCount,
			};
		});
	}, [filteredArticles]);

	const timelineReports = useMemo(() => {
		return [...preparedReports]
			.sort((a, b) => {
				const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
				const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
				return bTime - aTime;
			})
			.slice(0, 5);
	}, [preparedReports]);

	const aggregatedStats = useMemo(() => {
		if (preparedReports.length === 0) {
			return {
				uniqueSources: 0,
				uniqueAuthors: 0,
				averageWordCount: 0,
				totalKeywords: 0,
				totalTags: 0,
				topKeywords: [] as string[],
				topTags: [] as string[],
			};
		}

		const sourceSet = new Set<string>();
		const authorSet = new Set<string>();
		const keywordCounts = new Map<string, number>();
		const tagCounts = new Map<string, number>();
		let totalWords = 0;

		preparedReports.forEach((report) => {
			sourceSet.add(report.source);
			report.authors.forEach((author) => authorSet.add(author));
			report.keywords.forEach((keyword) => {
				const key = keyword.toLowerCase();
				keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
			});
			report.tags.forEach((tag) => {
				const key = tag.toLowerCase();
				tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
			});
			totalWords += report.wordCount;
		});

		const sortedKeywords = [...keywordCounts.entries()].sort(
			(a, b) => b[1] - a[1]
		);
		const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

		return {
			uniqueSources: sourceSet.size,
			uniqueAuthors: authorSet.size,
			averageWordCount: Math.round(totalWords / preparedReports.length) || 0,
			totalKeywords: keywordCounts.size,
			totalTags: tagCounts.size,
			topKeywords: sortedKeywords.slice(0, 3).map(([keyword]) => keyword),
			topTags: sortedTags.slice(0, 3).map(([tag]) => tag),
		};
	}, [preparedReports]);

	const summaryHighlights = useMemo(() => {
		if (preparedReports.length === 0) {
			return [] as Array<{ title: string; description: string; color: string }>;
		}

		const highlights: Array<{
			title: string;
			description: string;
			color: string;
		}> = [];
		const articleLabel = preparedReports.length === 1 ? "article" : "articles";
		const sourceLabel =
			aggregatedStats.uniqueSources === 1 ? "source" : "sources";
		const authorLabel =
			aggregatedStats.uniqueAuthors === 1 ? "author" : "authors";

		highlights.push({
			title: `Collected ${preparedReports.length} ${articleLabel}`,
			description: `Coverage spans ${aggregatedStats.uniqueSources} ${sourceLabel} and ${aggregatedStats.uniqueAuthors} unique ${authorLabel}.`,
			color: "bg-green-500",
		});

		if (aggregatedStats.topKeywords.length > 0) {
			highlights.push({
				title: "Recurring keyword themes",
				description: aggregatedStats.topKeywords.join(", "),
				color: "bg-blue-500",
			});
		}

		if (aggregatedStats.topTags.length > 0) {
			highlights.push({
				title: "Most common tags",
				description: aggregatedStats.topTags.join(", "),
				color: "bg-purple-500",
			});
		}

		if (timelineReports.length > 0) {
			const recent = timelineReports[0];
			highlights.push({
				title: "Most recent update",
				description: `${recent.source} • ${recent.extractedAt}`,
				color: "bg-amber-500",
			});
		}

		return highlights;
	}, [aggregatedStats, preparedReports, timelineReports]);

	const handleExtract = async () => {
		const parsedCount = Number.parseInt(countInput, 10);
		const parsedMax = Number.parseInt(maxArticlesInput, 10);
		const safeCount = Number.isNaN(parsedCount)
			? scrapeParams.count
			: Math.max(1, parsedCount);
		const safeMax = Number.isNaN(parsedMax)
			? scrapeParams.maxArticles
			: Math.max(1, parsedMax);
		const websites = parseWebsiteInput(websiteInput);

		setScrapeParams({
			count: safeCount,
			maxArticles: safeMax,
			websites,
		});

		// Trigger scraping with new params
		await refetchScrape();
		// Refresh saved articles after scraping
		await refetchSaved();
	};

	const handleRefresh = () => {
		refetch();
	};

	// Only show the main centered loading state when we have no articles yet.
	// This prevents the large "Fetching latest articles…" spinner from
	// covering the UI while background refetches occur when articles are
	// already present.
	const loadingState = (isLoading || isPending) && articles.length === 0;
	const refetching = isFetching && !loadingState;
	const totalArticles = scrapeData?.total_articles ?? articles.length;
	const filteredCount = preparedReports.length;
	const errorMessage = isError
		? error instanceof Error
			? error.message
			: "Unable to fetch articles."
		: undefined;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold text-foreground">
					Intelligent Report Synthesis
				</h1>
				<p className="text-muted-foreground">
					Automatically extract and synthesize information from multiple web
					sources to generate comprehensive financial reports.
				</p>
			</div>

			{/* Data Sources Configuration */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Globe className="h-5 w-5" />
						<span>Data Source Configuration</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Configure and monitor data sources for automatic information
								extraction
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRefresh}
								disabled={loadingState}
							>
								<RefreshCw className="h-4 w-4 mr-1" />
								{loadingState ? "Refreshing" : "Refresh All"}
							</Button>
						</div>

						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{dataSourcesConfig.map((source) => (
								<div
									key={source.id}
									className="p-4 border rounded-lg space-y-3"
								>
									<div className="flex items-start justify-between">
										<div>
											<h3 className="font-medium">{source.name}</h3>
											<p className="text-sm text-muted-foreground">
												{source.url}
											</p>
										</div>
										<Badge
											variant={
												source.status === "active" ? "default" : "secondary"
											}
										>
											{source.status}
										</Badge>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between text-xs">
											<span className="text-muted-foreground">
												Last Updated:
											</span>
											<span>{source.lastUpdate}</span>
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Data Points:
											</p>
											<div className="flex flex-wrap gap-1">
												{source.dataPoints.map((point, idx) => (
													<Badge
														key={idx}
														variant="outline"
														className="text-xs"
													>
														{point}
													</Badge>
												))}
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Search & Extract Section */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Search className="h-5 w-5" />
						<span>Extract Information</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
							<Input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Filter articles by keyword, title, or source"
							/>
							<Input
								type="number"
								min={1}
								value={countInput}
								onChange={(event) => setCountInput(event.target.value)}
								placeholder="Articles per source"
							/>
							<Input
								type="number"
								min={1}
								value={maxArticlesInput}
								onChange={(event) => setMaxArticlesInput(event.target.value)}
								placeholder="Max articles"
							/>
						</div>

						<Textarea
							value={websiteInput}
							onChange={(event) => setWebsiteInput(event.target.value)}
							placeholder="Optional: provide custom websites (comma or newline separated)"
							className="min-h-[80px]"
						/>

						<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div className="flex items-center space-x-4 text-sm text-muted-foreground">
								<div className="flex items-center space-x-1">
									<Filter className="h-4 w-4" />
									<span>{`Count per source: ${scrapeParams.count}`}</span>
								</div>
								<div className="flex items-center space-x-1">
									<Globe className="h-4 w-4" />
									<span>
										{scrapeParams.websites.length > 0
											? `${scrapeParams.websites.length} custom source(s)`
											: "Using default source list"}
									</span>
								</div>
							</div>
							<Button onClick={handleExtract} disabled={loadingState}>
								<Search className="h-4 w-4 mr-1" />
								{loadingState ? "Extracting" : "Extract Reports"}
							</Button>
						</div>

						{scrapeData?.message ? (
							<div className="text-xs text-muted-foreground">
								Status: {scrapeData.message}
							</div>
						) : null}
					</div>
				</CardContent>
			</Card>

			{/* Extracted Reports */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<div className="flex items-center space-x-2">
							<FileText className="h-5 w-5" />
							<span>Extracted Reports</span>
						</div>
						<div className="flex items-center space-x-2">
							<Badge variant="secondary">
								{filteredCount} {filteredCount === 1 ? "article" : "articles"}
							</Badge>
							{refetching ? (
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
							) : null}
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{favoriteFeedback ? (
							<div
								className={`rounded-md border px-3 py-2 text-xs ${
									favoriteFeedback.type === "error"
										? "border-destructive text-destructive"
										: favoriteFeedback.type === "success"
										? "border-green-500 text-green-600"
										: "border-border text-muted-foreground"
								}`}
							>
								{favoriteFeedback.text}
							</div>
						) : null}
						{loadingState ? (
							<div className="flex items-center justify-center py-10 text-muted-foreground">
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								Fetching latest articles…
							</div>
						) : isError ? (
							<div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								<AlertCircle className="h-4 w-4" />
								<span>{errorMessage}</span>
							</div>
						) : preparedReports.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No articles match the current filters. Adjust your query or
								scrape new sources.
							</p>
						) : (
							<>
								{preparedReports.map((report) => {
									const meta = getSourceMeta(report.source);
									return (
										<div
											key={report.id}
											className="group p-5 border rounded-lg space-y-3 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer bg-card"
											onClick={() => setSelectedArticle(report)}
										>
											<div className="flex items-start justify-between gap-4">
												<div className="flex-1 min-w-0">
													<h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
														{report.title}
													</h3>
													<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
														<Badge variant="outline" className="text-xs">
															<div
																className={`w-2 h-2 rounded-full ${meta.color} mr-1.5`}
															/>
															{report.source}
														</Badge>
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{report.extractedAt}
														</span>
														<span className="flex items-center gap-1">
															<FileText className="h-3 w-3" />
															{report.wordCount} words
														</span>
													</div>
												</div>
												<div className="flex flex-col items-end gap-2">
													<Badge
														variant={
															report.sentiment === "positive"
																? "default"
																: report.sentiment === "negative"
																? "destructive"
																: "secondary"
														}
														className="text-xs"
													>
														{report.sentiment === "positive" && (
															<TrendingUp className="h-3 w-3 mr-1" />
														)}
														{report.sentiment === "negative" && (
															<TrendingDown className="h-3 w-3 mr-1" />
														)}
														{report.sentiment === "neutral" && (
															<Minus className="h-3 w-3 mr-1" />
														)}
														{report.sentiment}
													</Badge>
													<Badge variant="outline" className="text-xs">
														{report.status}
													</Badge>
												</div>
											</div>

											<p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
												{report.summary}
											</p>

											{report.keywords.length > 0 && (
												<div className="flex flex-wrap gap-1.5">
													{report.keywords.slice(0, 6).map((keyword, idx) => (
														<Badge
															key={idx}
															variant="secondary"
															className="text-xs px-2 py-0"
														>
															{keyword}
														</Badge>
													))}
													{report.keywords.length > 6 && (
														<Badge
															variant="secondary"
															className="text-xs px-2 py-0"
														>
															+{report.keywords.length - 6} more
														</Badge>
													)}
												</div>
											)}

											<div className="flex items-center justify-between pt-2 border-t">
												<div className="flex items-center gap-3 text-xs text-muted-foreground">
													{report.authors.length > 0 && (
														<span className="flex items-center gap-1">
															<span className="font-medium">By:</span>
															{report.authors.slice(0, 2).join(", ")}
															{report.authors.length > 2 &&
																` +${report.authors.length - 2}`}
														</span>
													)}
												</div>
												<div className="flex items-center gap-2">
													<Button
														variant="ghost"
														size="sm"
														className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
														onClick={(e) => {
															e.stopPropagation();
															setSelectedArticle(report);
														}}
													>
														Read Full Article
														<ExternalLink className="h-3 w-3 ml-1" />
													</Button>

													<Button
														variant={
															favoriteIds.has(report.dbId || "")
																? "destructive"
																: "ghost"
														}
														size="sm"
														className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
														disabled={!report.dbId || !isAuthenticated}
														title={
															!isAuthenticated
																? "Sign in to favorite articles"
																: !report.dbId
																? "Article must be saved first"
																: ""
														}
														onClick={async (e) => {
															e.stopPropagation();
															if (!report.dbId) {
																setFavoriteFeedback({
																	type: "info",
																	text: "Save the article before adding it to favorites.",
																});
																return;
															}
															if (!isAuthenticated) {
																setFavoriteFeedback({
																	type: "info",
																	text: "Sign in to manage your favorite articles.",
																});
																return;
															}
															const alreadyFavorite = favoriteIds.has(
																report.dbId
															);
															try {
																if (alreadyFavorite) {
																	await removeFavoriteMutation.mutateAsync(
																		report.dbId
																	);
																	setFavoriteFeedback({
																		type: "info",
																		text: "Removed from favorites.",
																	});
																} else {
																	await addFavoriteMutation.mutateAsync(
																		report.dbId
																	);
																	setFavoriteFeedback({
																		type: "success",
																		text: "Added to favorites.",
																	});
																}
															} catch (err) {
																console.error("toggle favorite failed", err);
																const message =
																	err instanceof Error
																		? err.message
																		: "Unable to update favorite.";
																setFavoriteFeedback({
																	type: "error",
																	text: message,
																});
																if (
																	message.toLowerCase().includes("credential")
																) {
																	localStorage.removeItem("auth_token");
																	setAuthToken(null);
																}
															}
														}}
													>
														<Heart className="h-4 w-4 mr-1" />
														{favoriteIds.has(report.dbId || "")
															? "Favorited"
															: "Favorite"}
													</Button>
												</div>
											</div>
										</div>
									);
								})}{" "}
								<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
									<span>
										Showing {filteredCount} of {totalArticles} scraped article
										{totalArticles === 1 ? "" : "s"}.
									</span>
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="secondary"
											className="bg-accent text-accent-foreground"
											disabled={preparedReports.length === 0}
										>
											<FileText className="h-4 w-4 mr-1" />
											Synthesize All Reports
										</Button>

										<Button
											size="sm"
											variant="outline"
											onClick={async () => {
												if (!isAuthenticated) {
													setFavoriteFeedback({
														type: "info",
														text: "Sign in to favorite all articles.",
													});
													return;
												}
												const toFavorite = preparedReports
													.map((r) => r.dbId)
													.filter(Boolean) as string[];
												if (toFavorite.length === 0) {
													setFavoriteFeedback({
														type: "info",
														text: "No saved articles available to favorite yet.",
													});
													return;
												}
												let createdCount = 0;
												for (const id of toFavorite) {
													if (!favoriteIds.has(id)) {
														try {
															await addFavoriteMutation.mutateAsync(id);
															createdCount += 1;
														} catch (err) {
															console.error("favorite all failed", err);
															const message =
																err instanceof Error
																	? err.message
																	: "Unable to favorite articles.";
															setFavoriteFeedback({
																type: "error",
																text: message,
															});
															if (
																message.toLowerCase().includes("credential")
															) {
																localStorage.removeItem("auth_token");
																setAuthToken(null);
															}
															return;
														}
													}
												}
												setFavoriteFeedback({
													type: createdCount > 0 ? "success" : "info",
													text:
														createdCount > 0
															? `Favorited ${createdCount} article${
																	createdCount === 1 ? "" : "s"
															  }.`
															: "All saved articles are already in favorites.",
												});
											}}
											disabled={
												preparedReports.length === 0 || !isAuthenticated
											}
											title={
												!isAuthenticated ? "Sign in to favorite articles" : ""
											}
										>
											<FileText className="h-4 w-4 mr-1" />
											Favorite All
										</Button>
									</div>
								</div>
							</>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Sample Synthesized Report View */}
			<Card>
				<CardHeader>
					<CardTitle>Sample Synthesized Report - Apple Inc. Analysis</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="summary" className="space-y-4">
						<TabsList>
							<TabsTrigger value="summary">Executive Summary</TabsTrigger>
							<TabsTrigger value="sources">Source Analysis</TabsTrigger>
							<TabsTrigger value="metrics">Key Metrics</TabsTrigger>
							<TabsTrigger value="timeline">Timeline View</TabsTrigger>
						</TabsList>

						<TabsContent value="summary">
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-2">
										<Badge variant="default">Live Data</Badge>
										<Badge variant="outline">
											{aggregatedStats.uniqueSources} source
											{aggregatedStats.uniqueSources === 1 ? "" : "s"}
										</Badge>
									</div>
									<div className="flex space-x-2">
										<Button
											variant="outline"
											size="sm"
											disabled={preparedReports.length === 0}
										>
											<Save className="h-4 w-4 mr-1" />
											Save
										</Button>
										<Button
											variant="outline"
											size="sm"
											disabled={preparedReports.length === 0}
										>
											<Download className="h-4 w-4 mr-1" />
											Export
										</Button>
									</div>
								</div>

								<div className="p-4 bg-muted/20 rounded-lg">
									<h3 className="font-medium mb-2">Synthesis Summary</h3>
									{preparedReports.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											Run an extraction to populate the synthesis overview.
										</p>
									) : (
										<>
											<p className="text-sm text-muted-foreground mb-4">
												Based on {preparedReports.length} article
												{preparedReports.length === 1 ? "" : "s"} collected from
												{aggregatedStats.uniqueSources} source
												{aggregatedStats.uniqueSources === 1 ? "" : "s"}, here
												are the active themes:
											</p>

											<div className="space-y-3">
												{summaryHighlights.map((highlight, index) => (
													<div
														key={index}
														className="flex items-start space-x-3"
													>
														<div
															className={`w-2 h-2 rounded-full ${highlight.color} mt-2`}
														/>
														<div>
															<p className="font-medium text-sm">
																{highlight.title}
															</p>
															<p className="text-xs text-muted-foreground">
																{highlight.description ||
																	"Details unavailable."}
															</p>
														</div>
													</div>
												))}
											</div>
										</>
									)}
								</div>
							</div>
						</TabsContent>

						<TabsContent value="sources">
							<Card>
								<CardHeader>
									<CardTitle>Source Reliability & Coverage</CardTitle>
								</CardHeader>
								<CardContent>
									{preparedReports.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											Scrape articles to review source reliability.
										</p>
									) : (
										<div className="space-y-4">
											{preparedReports.slice(0, 12).map((report) => {
												const meta = getSourceMeta(report.source);
												return (
													<div
														key={report.id}
														className="flex items-center justify-between p-3 border rounded-lg"
													>
														<div className="flex items-center space-x-3">
															<div
																className={`w-3 h-3 rounded-full ${meta.color}`}
															/>
															<div>
																<p className="font-medium text-sm">
																	{report.source}
																</p>
																<p className="text-xs text-muted-foreground line-clamp-1">
																	{report.title}
																</p>
															</div>
														</div>
														<div className="flex items-center space-x-2">
															<Badge variant="outline" className="text-xs">
																{meta.label}
															</Badge>
															<span className="text-xs text-muted-foreground">
																{report.extractedAt}
															</span>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="metrics">
							<Card>
								<CardHeader>
									<CardTitle>Aggregated Key Metrics</CardTitle>
								</CardHeader>
								<CardContent>
									{preparedReports.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											Scraped article metrics will appear here once data is
											available.
										</p>
									) : (
										<>
											<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
												<div className="text-center p-4 bg-muted/20 rounded-lg">
													<p className="text-2xl font-bold text-primary">
														{preparedReports.length}
													</p>
													<p className="text-sm text-muted-foreground">
														Articles collected
													</p>
												</div>
												<div className="text-center p-4 bg-muted/20 rounded-lg">
													<p className="text-2xl font-bold">
														{aggregatedStats.averageWordCount}
													</p>
													<p className="text-sm text-muted-foreground">
														Avg. word count
													</p>
												</div>
												<div className="text-center p-4 bg-muted/20 rounded-lg">
													<p className="text-2xl font-bold text-green-600">
														{aggregatedStats.totalKeywords}
													</p>
													<p className="text-sm text-muted-foreground">
														Unique keywords
													</p>
												</div>
												<div className="text-center p-4 bg-muted/20 rounded-lg">
													<p className="text-2xl font-bold text-blue-600">
														{aggregatedStats.totalTags}
													</p>
													<p className="text-sm text-muted-foreground">
														Unique tags
													</p>
												</div>
											</div>

											<div className="mt-6 grid gap-4 lg:grid-cols-2">
												<div className="p-4 bg-muted/20 rounded-lg space-y-3">
													<h4 className="font-medium">Keyword Momentum</h4>
													{aggregatedStats.topKeywords.length === 0 ? (
														<p className="text-xs text-muted-foreground">
															No recurring keywords detected yet.
														</p>
													) : (
														<ul className="space-y-2 text-xs text-muted-foreground">
															{aggregatedStats.topKeywords.map((keyword) => (
																<li
																	key={keyword}
																	className="flex justify-between"
																>
																	<span className="capitalize">{keyword}</span>
																	<span>Trending</span>
																</li>
															))}
														</ul>
													)}
												</div>
												<div className="p-4 bg-muted/20 rounded-lg space-y-3">
													<h4 className="font-medium">Source Diversity</h4>
													<p className="text-xs text-muted-foreground">
														{aggregatedStats.uniqueSources} unique source
														{aggregatedStats.uniqueSources === 1
															? ""
															: "s"} • {aggregatedStats.uniqueAuthors}{" "}
														contributor
														{aggregatedStats.uniqueAuthors === 1 ? "" : "s"}
													</p>
													{aggregatedStats.topTags.length === 0 ? (
														<p className="text-xs text-muted-foreground">
															Tag coverage pending.
														</p>
													) : (
														<ul className="space-y-2 text-xs text-muted-foreground">
															{aggregatedStats.topTags.map((tag) => (
																<li key={tag} className="capitalize">
																	#{tag}
																</li>
															))}
														</ul>
													)}
												</div>
											</div>
										</>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="timeline">
							<Card>
								<CardHeader>
									<CardTitle>Information Timeline</CardTitle>
								</CardHeader>
								<CardContent>
									{timelineReports.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											Articles with publish dates will appear in chronological
											order once scraped.
										</p>
									) : (
										<div className="space-y-4">
											<div className="relative">
												<div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
												<div className="space-y-6">
													{timelineReports.map((report, index) => (
														<div
															key={report.id}
															className="flex items-start space-x-4"
														>
															<div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-medium">
																{index + 1}
															</div>
															<div className="flex-1">
																<div className="flex items-center justify-between">
																	<h4 className="font-medium text-sm line-clamp-1">
																		{report.title}
																	</h4>
																	<span className="text-xs text-muted-foreground">
																		{report.source}
																	</span>
																</div>
																<p className="text-xs text-muted-foreground mt-1">
																	{report.summary}
																</p>
																<p className="mt-1 text-xs text-muted-foreground">
																	{report.extractedAt}
																</p>
															</div>
														</div>
													))}
												</div>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Article Detail Modal */}
			<Dialog
				open={!!selectedArticle}
				onOpenChange={(open) => !open && setSelectedArticle(null)}
			>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					{selectedArticle && (
						<>
							<DialogHeader>
								<DialogTitle className="text-xl pr-8">
									{selectedArticle.title}
								</DialogTitle>
								<DialogDescription className="space-y-3 pt-2">
									<div className="flex flex-wrap items-center gap-3 text-sm">
										<Badge variant="outline">
											<div
												className={`w-2 h-2 rounded-full ${
													getSourceMeta(selectedArticle.source).color
												} mr-1.5`}
											/>
											{selectedArticle.source}
										</Badge>
										<span className="flex items-center gap-1.5 text-muted-foreground">
											<Clock className="h-3.5 w-3.5" />
											{selectedArticle.extractedAt}
										</span>
										<Badge
											variant={
												selectedArticle.sentiment === "positive"
													? "default"
													: selectedArticle.sentiment === "negative"
													? "destructive"
													: "secondary"
											}
										>
											{selectedArticle.sentiment === "positive" && (
												<TrendingUp className="h-3 w-3 mr-1" />
											)}
											{selectedArticle.sentiment === "negative" && (
												<TrendingDown className="h-3 w-3 mr-1" />
											)}
											{selectedArticle.sentiment === "neutral" && (
												<Minus className="h-3 w-3 mr-1" />
											)}
											{selectedArticle.sentiment}
										</Badge>
										<span className="flex items-center gap-1.5 text-muted-foreground">
											<FileText className="h-3.5 w-3.5" />
											{selectedArticle.wordCount.toLocaleString()} words
										</span>
									</div>
									{selectedArticle.authors.length > 0 && (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<span className="font-medium">Authors:</span>
											<span>{selectedArticle.authors.join(", ")}</span>
										</div>
									)}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								{/* Keywords and Tags */}
								{(selectedArticle.keywords.length > 0 ||
									selectedArticle.tags.length > 0) && (
									<div className="space-y-3">
										{selectedArticle.keywords.length > 0 && (
											<div>
												<h4 className="text-sm font-medium mb-2">Keywords</h4>
												<div className="flex flex-wrap gap-1.5">
													{selectedArticle.keywords.map((keyword, idx) => (
														<Badge
															key={idx}
															variant="secondary"
															className="text-xs"
														>
															{keyword}
														</Badge>
													))}
												</div>
											</div>
										)}
										{selectedArticle.tags.length > 0 && (
											<div>
												<h4 className="text-sm font-medium mb-2">Tags</h4>
												<div className="flex flex-wrap gap-1.5">
													{selectedArticle.tags.map((tag, idx) => (
														<Badge
															key={idx}
															variant="outline"
															className="text-xs"
														>
															#{tag}
														</Badge>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{/* Full Article Content */}
								<div className="prose prose-sm dark:prose-invert max-w-none">
									<div className="p-4 bg-muted/30 rounded-lg border">
										<p className="text-sm leading-relaxed whitespace-pre-wrap">
											{filteredArticles.find(
												(a) =>
													(a.link ||
														`article-${filteredArticles.indexOf(a)}`) ===
													selectedArticle.id
											)?.text || selectedArticle.summary}
										</p>
									</div>
								</div>

								{/* Article Stats */}
								<div className="grid grid-cols-3 gap-3">
									<div className="text-center p-3 bg-muted/20 rounded-lg">
										<p className="text-xs text-muted-foreground">Word Count</p>
										<p className="font-semibold text-lg">
											{selectedArticle.wordCount.toLocaleString()}
										</p>
									</div>
									<div className="text-center p-3 bg-muted/20 rounded-lg">
										<p className="text-xs text-muted-foreground">Keywords</p>
										<p className="font-semibold text-lg">
											{selectedArticle.keywords.length}
										</p>
									</div>
									<div className="text-center p-3 bg-muted/20 rounded-lg">
										<p className="text-xs text-muted-foreground">Status</p>
										<p className="font-semibold text-sm capitalize">
											{selectedArticle.status}
										</p>
									</div>
								</div>
							</div>

							<DialogFooter className="gap-2 sm:gap-0">
								<Button
									variant="outline"
									onClick={() => setSelectedArticle(null)}
								>
									Close
								</Button>
								<Button asChild className="gap-2">
									<a
										href={selectedArticle.url}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Globe className="h-4 w-4" />
										View Original Article
										<ExternalLink className="h-4 w-4" />
									</a>
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
