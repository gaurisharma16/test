import { useMemo, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Bell,
	Globe,
	RefreshCw,
	ExternalLink,
	Send,
	Mail,
	Loader2,
	AlertCircle,
} from "lucide-react";
import {
	useIndiaFilings,
	useUSFilings,
	useEmailIndiaFilings,
	useEmailUSFilings,
	useWatchlistFilings,
	useMarketFilingsHistory,
} from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_COUNT = 10;

type EmailFormState = {
	to: string;
	cc: string;
};

type FilingRecord = {
	title?: string;
	link?: string;
	company?: string;
	date?: string;
	[key: string]: unknown;
};

type WatchlistFiling = {
	id: string;
	source: string;
	title: string;
	company?: string;
	link: string;
	date?: string;
	created_at?: string;
};

function formatChange(value: number) {
	const rounded = Number.isFinite(value) ? value : 0;
	const formatted = Math.abs(rounded).toFixed(2);
	return `${rounded >= 0 ? "+" : "-"}${formatted}%`;
}

function normaliseTitle(filing: FilingRecord): string {
	return filing.title || filing.company || "Untitled filing";
}

function normaliseDate(filing: FilingRecord): string | undefined {
	if (!filing.date) {
		return undefined;
	}
	try {
		const parsed = new Date(filing.date);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toLocaleDateString();
		}
	} catch (error) {
		return filing.date;
	}
	return filing.date;
}

function normaliseCompany(filing: FilingRecord): string | undefined {
	return filing.company;
}

export default function FilingsAlerts() {
	const { toast } = useToast();
	const [activeRegion, setActiveRegion] = useState<"us" | "india">("us");
	const [emailForm, setEmailForm] = useState<EmailFormState>({
		to: "",
		cc: "",
	});
	const [watchlistInput, setWatchlistInput] = useState("AAPL,MSFT,GOOGL");
	const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([
		"AAPL",
		"MSFT",
		"GOOGL",
	]);

	// Live fetch queries (disabled by default, triggered manually)
	const usQuery = useUSFilings(DEFAULT_COUNT, false);
	const indiaQuery = useIndiaFilings(DEFAULT_COUNT, false);

	// History queries (primary display source)
	const usHistory = useMarketFilingsHistory("us", 50);
	const indiaHistory = useMarketFilingsHistory("india", 50);

	const sendUsFilings = useEmailUSFilings();
	const sendIndiaFilings = useEmailIndiaFilings();
	const watchlistQuery = useWatchlistFilings(watchlistSymbols, undefined, 100);

	const statsCards = useMemo(
		() => [
			{
				title: "US SEC filings",
				value: usHistory.data ? String(usHistory.data.length) : "--",
				description: "Latest entries from database",
				icon: Globe,
			},
			{
				title: "India SEBI filings",
				value: indiaHistory.data ? String(indiaHistory.data.length) : "--",
				description: "Most recent disclosures from database",
				icon: Bell,
			},
		],
		[usHistory.data, indiaHistory.data]
	);

	const filings: FilingRecord[] = useMemo(() => {
		const history = activeRegion === "us" ? usHistory : indiaHistory;
		if (history.data && Array.isArray(history.data)) {
			return history.data as FilingRecord[];
		}
		return [];
	}, [activeRegion, usHistory.data, indiaHistory.data]);

	const activeQuery = activeRegion === "us" ? usQuery : indiaQuery;
	const activeHistory = activeRegion === "us" ? usHistory : indiaHistory;
	const isSendingEmail = sendUsFilings.isPending || sendIndiaFilings.isPending;

	const handleRefresh = async () => {
		// Trigger live fetch to update DB
		await activeQuery.refetch();
		// Then refresh history to show new items
		await activeHistory.refetch();
	};

	const handleWatchlistUpdate = () => {
		const symbols = watchlistInput
			.split(",")
			.map((entry) => entry.trim().toUpperCase())
			.filter((entry) => entry.length > 0);
		setWatchlistSymbols(symbols);
	};

	const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!emailForm.to.trim()) {
			toast({
				title: "Recipient email required",
				description: "Add an email address before sending the digest.",
				variant: "destructive",
			});
			return;
		}

		const ccList = emailForm.cc
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);

		try {
			if (activeRegion === "us") {
				await sendUsFilings.mutateAsync({
					to: emailForm.to.trim(),
					cc: ccList.length ? ccList : undefined,
				});
			} else {
				await sendIndiaFilings.mutateAsync({
					to: emailForm.to.trim(),
					cc: ccList.length ? ccList : undefined,
				});
			}

			toast({
				title: "Digest sent",
				description: `Shared ${activeRegion.toUpperCase()} filings with ${emailForm.to.trim()}.`,
			});
			setEmailForm({ to: "", cc: "" });
		} catch (error) {
			toast({
				title: "Failed to send digest",
				description: error instanceof Error ? error.message : "Unknown error",
				variant: "destructive",
			});
		}
	};

	const renderStateMessage = (region: "us" | "india") => {
		if (activeRegion !== region) {
			return null;
		}

		const query = region === "us" ? usQuery : indiaQuery;
		const regionFilings = filings;

		if (activeHistory.isLoading) {
			return (
				<p className="text-sm text-muted-foreground">Loading filings...</p>
			);
		}
		if (activeHistory.error) {
			return (
				<Alert variant="destructive">
					<AlertTitle>Unable to fetch filings</AlertTitle>
					<AlertDescription>
						{(activeHistory.error as Error).message ||
							"The backend did not return filings."}
					</AlertDescription>
				</Alert>
			);
		}
		if (regionFilings.length === 0) {
			return (
				<p className="text-sm text-muted-foreground">
					No filings available for this region.
				</p>
			);
		}
		return null;
	};

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold text-foreground">
					Corporate filings alerts
				</h1>
				<p className="text-muted-foreground">
					Track regulatory disclosures from US and India markets, refresh data
					on demand, and email curated digests to your team.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{statsCards.map((card) => (
					<Card key={card.title}>
						<CardContent className="p-4 flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">{card.title}</p>
								<p className="text-2xl font-bold mt-2">{card.value}</p>
								<p className="text-xs text-muted-foreground mt-2">
									{card.description}
								</p>
							</div>
							<card.icon className="h-8 w-8 text-primary" />
						</CardContent>
					</Card>
				))}
			</div>

			<Tabs
				value={activeRegion}
				onValueChange={(value) => setActiveRegion(value as "us" | "india")}
			>
				<TabsList>
					<TabsTrigger value="us">US Filings</TabsTrigger>
					<TabsTrigger value="india">India Filings</TabsTrigger>
				</TabsList>

				<TabsContent value="us" className="space-y-4">
					<Card>
						<CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
							<CardTitle className="flex items-center space-x-2">
								<Globe className="h-5 w-5" />
								<span>SEC recent filings</span>
							</CardTitle>
							<Button
								variant="outline"
								onClick={handleRefresh}
								disabled={activeQuery.isFetching || activeHistory.isFetching}
							>
								<RefreshCw
									className={`h-4 w-4 mr-2 ${
										activeQuery.isFetching || activeHistory.isFetching
											? "animate-spin"
											: ""
									}`}
								/>
								Refresh feed
							</Button>
						</CardHeader>
						<CardContent className="space-y-4">
							{renderStateMessage("us")}
							{activeRegion === "us" && filings.length > 0 && (
								<div className="space-y-3">
									{filings.map((filing, index) => (
										<div
											key={`${filing.link ?? filing.title ?? index}-${index}`}
											className="border rounded-lg p-4 flex items-start justify-between gap-4"
										>
											<div>
												<p className="font-medium text-sm">
													{normaliseTitle(filing)}
												</p>
												{filing.link && (
													<p className="text-xs text-muted-foreground break-all mt-1">
														{filing.link}
													</p>
												)}
											</div>
											{filing.link && (
												<Button variant="outline" size="sm" asChild>
													<a
														href={filing.link}
														target="_blank"
														rel="noreferrer"
													>
														<ExternalLink className="h-4 w-4 mr-1" />
														View
													</a>
												</Button>
											)}
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="india" className="space-y-4">
					<Card>
						<CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
							<CardTitle className="flex items-center space-x-2">
								<Bell className="h-5 w-5" />
								<span>SEBI recent filings</span>
							</CardTitle>
							<Button
								variant="outline"
								onClick={handleRefresh}
								disabled={activeQuery.isFetching || activeHistory.isFetching}
							>
								<RefreshCw
									className={`h-4 w-4 mr-2 ${
										activeQuery.isFetching || activeHistory.isFetching
											? "animate-spin"
											: ""
									}`}
								/>
								Refresh feed
							</Button>
						</CardHeader>
						<CardContent className="space-y-4">
							{renderStateMessage("india")}
							{activeRegion === "india" && filings.length > 0 && (
								<div className="space-y-3">
									{filings.map((filing, index) => (
										<div
											key={`${filing.link ?? filing.title ?? index}-${index}`}
											className="border rounded-lg p-4 flex items-start justify-between gap-4"
										>
											<div className="space-y-1">
												<p className="font-medium text-sm">
													{normaliseTitle(filing)}
												</p>
												{normaliseDate(filing) && (
													<p className="text-xs text-muted-foreground">
														Filed: {normaliseDate(filing)}
													</p>
												)}
												{filing.company && (
													<Badge variant="secondary" className="w-fit text-xs">
														{filing.company}
													</Badge>
												)}
											</div>
											{filing.link && (
												<Button variant="outline" size="sm" asChild>
													<a
														href={filing.link}
														target="_blank"
														rel="noreferrer"
													>
														<ExternalLink className="h-4 w-4 mr-1" />
														View
													</a>
												</Button>
											)}
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center space-x-2">
						<Mail className="h-5 w-5" />
						<span>Send filings digest</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-3"
						onSubmit={handleEmailSubmit}
					>
						<div className="md:col-span-1">
							<label htmlFor="email-recipient" className="text-sm font-medium">
								Recipient email
							</label>
							<Input
								id="email-recipient"
								type="email"
								placeholder="analyst@example.com"
								value={emailForm.to}
								onChange={(event) =>
									setEmailForm((prev) => ({ ...prev, to: event.target.value }))
								}
								required
							/>
						</div>
						<div className="md:col-span-1">
							<label htmlFor="email-cc" className="text-sm font-medium">
								CC (comma separated)
							</label>
							<Input
								id="email-cc"
								placeholder="team@example.com"
								value={emailForm.cc}
								onChange={(event) =>
									setEmailForm((prev) => ({ ...prev, cc: event.target.value }))
								}
							/>
						</div>
						<div className="md:col-span-1 flex items-end">
							<Button
								type="submit"
								className="w-full"
								disabled={isSendingEmail}
							>
								{isSendingEmail ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Send className="h-4 w-4 mr-2" />
								)}
								{isSendingEmail
									? "Sending..."
									: `Send ${activeRegion.toUpperCase()} digest`}
							</Button>
						</div>
					</form>
					<p className="text-xs text-muted-foreground mt-2">
						The digest uses the latest filings returned by the{" "}
						{activeRegion.toUpperCase()} endpoint.
					</p>
				</CardContent>
			</Card>

			{(sendUsFilings.error || sendIndiaFilings.error) && (
				<Alert variant="destructive">
					<AlertTitle>Email delivery failed</AlertTitle>
					<AlertDescription>
						{((sendUsFilings.error || sendIndiaFilings.error) as Error)
							.message || "An error occurred while sending filings via email."}
					</AlertDescription>
				</Alert>
			)}

			{activeQuery.error && !activeQuery.isLoading && (
				<Alert variant="destructive" className="flex items-start gap-2">
					<AlertCircle className="h-4 w-4 mt-0.5" />
					<div>
						<AlertTitle>Realtime feed encountered an error</AlertTitle>
						<AlertDescription>
							{(activeQuery.error as Error).message ||
								"No additional details were provided."}
						</AlertDescription>
					</div>
				</Alert>
			)}

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<CardTitle>Watchlist Corporate Filings</CardTitle>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<Input
								value={watchlistInput}
								onChange={(event) => setWatchlistInput(event.target.value)}
								placeholder="Comma separated symbols (e.g., AAPL, MSFT, GOOGL)"
							/>
							<Button
								size="sm"
								onClick={handleWatchlistUpdate}
								disabled={watchlistQuery.isPending}
							>
								Update
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{watchlistSymbols.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Add at least one company symbol to see relevant corporate filings.
						</p>
					) : watchlistQuery.isLoading || watchlistQuery.isPending ? (
						<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Loading watchlist filings…
						</div>
					) : watchlistQuery.isError ? (
						<div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							<AlertCircle className="h-4 w-4" />
							<span>
								{watchlistQuery.error instanceof Error
									? watchlistQuery.error.message
									: "Unable to load watchlist filings."}
							</span>
						</div>
					) : watchlistQuery.data?.filings &&
					  watchlistQuery.data.filings.length > 0 ? (
						<div className="space-y-3">
							<p className="text-xs text-muted-foreground">
								Showing {watchlistQuery.data.count} filing
								{watchlistQuery.data.count !== 1 ? "s" : ""} matching:{" "}
								{watchlistQuery.data.symbols.join(", ")}
							</p>
							{watchlistQuery.data.filings.map((filing, index) => (
								<div
									key={`${filing.id}-${index}`}
									className="border rounded-lg p-4 flex items-start justify-between gap-4"
								>
									<div className="space-y-1">
										<p className="font-medium text-sm">{filing.title}</p>
										{filing.company && (
											<Badge variant="secondary" className="w-fit text-xs">
												{filing.company}
											</Badge>
										)}
										{filing.date && (
											<p className="text-xs text-muted-foreground">
												Filed: {new Date(filing.date).toLocaleDateString()}
											</p>
										)}
										<Badge
											variant="outline"
											className="w-fit text-xs uppercase"
										>
											{filing.source}
										</Badge>
									</div>
									{filing.link && (
										<Button variant="outline" size="sm" asChild>
											<a href={filing.link} target="_blank" rel="noreferrer">
												<ExternalLink className="h-4 w-4 mr-1" />
												View
											</a>
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No filings found for the specified symbols. Try different symbols
							or check back later.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
