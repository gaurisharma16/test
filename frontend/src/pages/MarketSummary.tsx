import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useMarketSummaryDaily,
  useMarketSectors,
  useMarketWatchlist,
} from "@/hooks/useApi";

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCurrency(value: number | null | undefined, region?: string) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "–";
  }
  const currency = region === "IN" ? "INR" : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

export default function MarketSummary() {
  const [dateInput, setDateInput] = useState<string>("");
  const [watchlistInput, setWatchlistInput] = useState("AAPL,MSFT,GOOGL");
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(["AAPL", "MSFT", "GOOGL"]);

  const dailySummaryQuery = useMarketSummaryDaily(dateInput || undefined);
  const sectorsQuery = useMarketSectors(dateInput || undefined);
  const watchlistQuery = useMarketWatchlist(watchlistSymbols);

  const isLoading = dailySummaryQuery.isLoading || dailySummaryQuery.isPending;
  const hasError = dailySummaryQuery.isError;

  const handleWatchlistUpdate = () => {
    const symbols = watchlistInput
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);
    setWatchlistSymbols(symbols);
  };

  const indices = dailySummaryQuery.data?.indices ?? [];
  const topGainers = dailySummaryQuery.data?.top_gainers ?? [];
  const topLosers = dailySummaryQuery.data?.top_losers ?? [];
  const marketNews = dailySummaryQuery.data?.market_news ?? [];

  const sectorData = useMemo(() => {
    if (!sectorsQuery.data?.sectors) return [] as Array<[string, Record<string, unknown>]>;
    return Object.entries(sectorsQuery.data.sectors);
  }, [sectorsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Daily Market Summary</h1>
          <p className="text-muted-foreground">
            Automated financial market insights pulled directly from the backend service.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              className="w-full sm:w-auto"
            />
            <Button variant="outline" onClick={() => dailySummaryQuery.refetch()}>
              <Calendar className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          <Button size="sm" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export snapshot
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Major Market Indices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading latest market snapshot…
            </div>
          ) : hasError ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{dailySummaryQuery.error instanceof Error ? dailySummaryQuery.error.message : "Unable to load market summary."}</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {indices.map((index) => (
                <div key={index.name} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{index.name}</h3>
                    {index.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : index.trend === "down" ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-2xl font-bold">{index.value.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={index.change >= 0 ? "text-green-600" : "text-red-600"}>
                      {index.change >= 0 ? "+" : ""}
                      {index.change.toFixed(2)}
                    </span>
                    <Badge variant={index.change_percent >= 0 ? "secondary" : "destructive"}>
                      {formatChange(index.change_percent)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top Gainers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGainers.slice(0, 5).map((item, index) => (
              <div
                key={`${item.symbol}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium leading-none">{item.symbol}</p>
                  {item.name && (
                    <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium">
                    {formatCurrency(item.price, item.region)}
                  </span>
                  <Badge className="bg-green-100 text-green-700">
                    {formatChange(item.change_percent)}
                  </Badge>
                </div>
              </div>
            ))}
            {topGainers.length === 0 && (
              <p className="text-sm text-muted-foreground">No gainers reported.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Top Losers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topLosers.slice(0, 5).map((item, index) => (
              <div
                key={`${item.symbol}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium leading-none">{item.symbol}</p>
                  {item.name && (
                    <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium">
                    {formatCurrency(item.price, item.region)}
                  </span>
                  <Badge className="bg-red-100 text-red-700">
                    {formatChange(item.change_percent)}
                  </Badge>
                </div>
              </div>
            ))}
            {topLosers.length === 0 && (
              <p className="text-sm text-muted-foreground">No losers reported.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sector Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {sectorsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading sectors…
            </div>
          ) : sectorData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sector data available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sectorData.map(([sector, details]) => (
                <div key={sector} className="rounded-lg border p-4">
                  <p className="text-sm font-semibold">{sector}</p>
                  <p className="text-xs text-muted-foreground">
                    Change: {formatChange(Number((details as Record<string, number>).change ?? 0))}
                  </p>
                  {Array.isArray((details as Record<string, unknown>).leaders) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Leaders: {(details as Record<string, string[]>).leaders.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Watchlist Performance</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={watchlistInput}
                onChange={(event) => setWatchlistInput(event.target.value)}
                placeholder="Comma separated symbols"
              />
              <Button size="sm" onClick={handleWatchlistUpdate} disabled={watchlistQuery.isPending}>
                Update
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {watchlistSymbols.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add at least one ticker to see watchlist performance.
            </p>
          ) : watchlistQuery.isLoading || watchlistQuery.isPending ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading watchlist…
            </div>
          ) : watchlistQuery.isError ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{watchlistQuery.error instanceof Error ? watchlistQuery.error.message : "Unable to load watchlist."}</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistQuery.data?.watchlist?.map((item, index) => (
                  <TableRow key={`${item.symbol}-${index}`}>
                    <TableCell className="font-medium">{item.symbol}</TableCell>
                    <TableCell>{item.price?.toLocaleString?.() ?? item.price}</TableCell>
                    <TableCell className={item.change_percent >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatChange(item.change_percent)}
                    </TableCell>
                    <TableCell>{item.volume?.toLocaleString?.() ?? item.volume}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}