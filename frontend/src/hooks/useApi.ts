/**
 * Custom React Query hooks for API calls
 * Provides data fetching, caching, and state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  marketApi,
  financialDataApi,
  articlesApi,
  editorialApi,
  reportAnalysisApi,
  filingsApi,
  adminApi,
  userSettingsApi,
  healthApi,
  userApi,
  type MarketSummary,
  type FileUploadResponse,
  type AnalysisResult,
  type EditorialSuggestion,
  type StyleGuide,
  type UserSettings,
} from "@/lib/api";

// ============ MARKET SUMMARY HOOKS ============

export function useMarketSummaryDaily(date?: string) {
  return useQuery({
    queryKey: ["marketSummary", "daily", date],
    queryFn: () => marketApi.getDaily(date),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

export function useMarketSectors(date?: string) {
  return useQuery({
    queryKey: ["marketSummary", "sectors", date],
    queryFn: () => marketApi.getSectors(date),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useMarketWatchlist(symbols: string[]) {
  return useQuery({
    queryKey: ["marketSummary", "watchlist", symbols.join(",")],
    queryFn: () => marketApi.getWatchlist(symbols),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ============ FINANCIAL DATA HOOKS ============

export function useUploadFinancialDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => financialDataApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financialData"] });
      queryClient.invalidateQueries({ queryKey: ["financialData", "history"] });
    },
  });
}

export function useAnalyzeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => financialDataApi.analyze(fileId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["financialData", data.file_id],
      });
      queryClient.invalidateQueries({ queryKey: ["financialData", "history"] });
    },
  });
}

export function useGetDocumentAnalysis(fileId: string) {
  return useQuery({
    queryKey: ["financialData", fileId],
    queryFn: () => financialDataApi.getAnalysis(fileId),
    enabled: !!fileId,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useFinancialAnalysisHistory(limit: number = 20) {
  return useQuery({
    queryKey: ["financialData", "history", limit],
    queryFn: () => financialDataApi.history(limit),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ============ ARTICLES HOOKS ============

type ScrapeArticlesParams = {
  count?: number;
  maxArticles?: number;
  websites?: string[];
  enabled?: boolean;
};

export function useScrapeArticles({
  count = 5,
  maxArticles = 100,
  websites = [],
  enabled = true,
}: ScrapeArticlesParams = {}) {
  return useQuery({
    queryKey: [
      "articles",
      "scrape",
      count,
      maxArticles,
      websites.join(","),
    ],
    queryFn: () => articlesApi.scrape(count, maxArticles, websites),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useSavedArticles(limit: number = 50, skip: number = 0) {
  return useQuery({
    queryKey: ["articles", "saved", limit, skip],
    queryFn: () => articlesApi.getSaved(limit, skip),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000,
  });
}

// ============ USER FAVORITES HOOKS ============
export function useListFavorites() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ["user", "favorites"],
    queryFn: () => userApi.listFavorites(),
    enabled: !!token, // Only fetch if authenticated
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false, // Don't retry on auth errors
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => userApi.addFavorite(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "favorites"] });
      queryClient.invalidateQueries({ queryKey: ["articles", "saved"] });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => userApi.removeFavorite(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "favorites"] });
      queryClient.invalidateQueries({ queryKey: ["articles", "saved"] });
    },
  });
}

// ============ EDITORIAL HOOKS ============

export function useEditorialSuggestions(
  text: string,
  contentType: string = "article",
  tone?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["editorial", "suggestions", text, contentType, tone ?? ""],
    queryFn: () => editorialApi.getSuggestions(text, contentType, tone),
    enabled: enabled && !!text,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useStyleGuide() {
  return useQuery({
    queryKey: ["editorial", "styleGuide"],
    queryFn: () => editorialApi.getStyleGuide(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useEditorialAnalytics() {
  return useQuery({
    queryKey: ["editorial", "analytics"],
    queryFn: () => editorialApi.getAnalytics(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
  });
}

export function useEditorialContext(
  options: { articleLimit?: number; reportLimit?: number; filingLimit?: number } = {}
) {
  const { articleLimit, reportLimit, filingLimit } = options;
  return useQuery({
    queryKey: [
      "editorial",
      "context",
      articleLimit ?? 10,
      reportLimit ?? 8,
      filingLimit ?? 8,
    ],
    queryFn: () =>
      editorialApi.getContext({
        articleLimit,
        reportLimit,
        filingLimit,
      }),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// ============ REPORT ANALYSIS HOOKS ============

export function useGenerateReportParameters(report: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["reportAnalysis", "parameters", report],
    queryFn: () => reportAnalysisApi.generateParameters(report),
    enabled: enabled && !!report,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useEvaluateParameter() {
  return useMutation({
    mutationFn: ({
      report,
      parameter,
    }: {
      report: string;
      parameter: any;
    }) => reportAnalysisApi.evaluateParameter(report, parameter),
  });
}

export function useFullReportAnalysis() {
  return useMutation({
    mutationFn: ({
      report,
    }: {
      report: string;
    }) => reportAnalysisApi.fullAnalysis(report),
  });
}

// ============ FILINGS HOOKS ============

export function useUSFilings(count: number = 10, enabled: boolean = true) {
  return useQuery({
    queryKey: ["filings", "us", count],
    queryFn: () => filingsApi.getUSFilings(count),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useIndiaFilings(count: number = 10, enabled: boolean = true) {
  return useQuery({
    queryKey: ["filings", "india", count],
    queryFn: () => filingsApi.getIndiaFilings(count),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useEmailUSFilings() {
  return useMutation({
    mutationFn: ({ to, cc }: { to: string; cc?: string[] }) =>
      filingsApi.emailUSFilings(to, cc),
  });
}

export function useEmailIndiaFilings() {
  return useMutation({
    mutationFn: ({ to, cc }: { to: string; cc?: string[] }) =>
      filingsApi.emailIndiaFilings(to, cc),
  });
}

export function useWatchlistFilings(symbols: string[], source?: string, limit?: number) {
  return useQuery({
    queryKey: ["filings", "watchlist", symbols.join(","), source, limit],
    queryFn: () => filingsApi.getWatchlistFilings(symbols, source, limit),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useMarketFilingsHistory(source?: string, limit: number = 50) {
  return useQuery({
    queryKey: ["filings", "history", source, limit],
    queryFn: () => filingsApi.getHistory(source, limit),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ============ ADMIN HOOKS ============

export function useSystemMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () => adminApi.getMetrics(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminApi.getSettings(),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      adminApi.updateSettings(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
}

export function useAdminUsers(limit: number = 10, offset: number = 0) {
  return useQuery({
    queryKey: ["admin", "users", limit, offset],
    queryFn: () => adminApi.getUsers(limit, offset),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAdminLogs(limit: number = 100) {
  return useQuery({
    queryKey: ["admin", "logs", limit],
    queryFn: () => adminApi.getLogs(limit),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ============ USER SETTINGS HOOKS ============

export function useUserSettings() {
  return useQuery({
    queryKey: ["userSettings"],
    queryFn: () => userSettingsApi.getSettings(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) =>
      userSettingsApi.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
  });
}

// ============ HEALTH CHECK HOOK ============

export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => healthApi.check(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 3,
  });
}
