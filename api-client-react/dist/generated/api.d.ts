import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Analysis, AnalysisInput, AnalysisStats, AnalysisSummary, ErrorResponse, HealthStatus, SolutionsResponse } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAnalysesUrl: () => string;
/**
 * Returns all saved analyses sorted by newest first
 * @summary List all saved analyses
 */
export declare const listAnalyses: (options?: RequestInit) => Promise<AnalysisSummary[]>;
export declare const getListAnalysesQueryKey: () => readonly ["/api/analyses"];
export declare const getListAnalysesQueryOptions: <TData = Awaited<ReturnType<typeof listAnalyses>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAnalysesQueryResult = NonNullable<Awaited<ReturnType<typeof listAnalyses>>>;
export type ListAnalysesQueryError = ErrorType<unknown>;
/**
 * @summary List all saved analyses
 */
export declare function useListAnalyses<TData = Awaited<ReturnType<typeof listAnalyses>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAnalysisUrl: () => string;
/**
 * Submits a document for deep red-team analysis using the specified lens
 * @summary Run a new document analysis
 */
export declare const createAnalysis: (analysisInput: AnalysisInput, options?: RequestInit) => Promise<Analysis>;
export declare const getCreateAnalysisMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
        data: BodyType<AnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
    data: BodyType<AnalysisInput>;
}, TContext>;
export type CreateAnalysisMutationResult = NonNullable<Awaited<ReturnType<typeof createAnalysis>>>;
export type CreateAnalysisMutationBody = BodyType<AnalysisInput>;
export type CreateAnalysisMutationError = ErrorType<ErrorResponse>;
/**
* @summary Run a new document analysis
*/
export declare const useCreateAnalysis: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
        data: BodyType<AnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAnalysis>>, TError, {
    data: BodyType<AnalysisInput>;
}, TContext>;
export declare const getGetAnalysisUrl: (id: number) => string;
/**
 * @summary Get a specific analysis
 */
export declare const getAnalysis: (id: number, options?: RequestInit) => Promise<Analysis>;
export declare const getGetAnalysisQueryKey: (id: number) => readonly [`/api/analyses/${number}`];
export declare const getGetAnalysisQueryOptions: <TData = Awaited<ReturnType<typeof getAnalysis>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalysisQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalysis>>>;
export type GetAnalysisQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get a specific analysis
 */
export declare function useGetAnalysis<TData = Awaited<ReturnType<typeof getAnalysis>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteAnalysisUrl: (id: number) => string;
/**
 * @summary Delete an analysis
 */
export declare const deleteAnalysis: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteAnalysisMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
    id: number;
}, TContext>;
export type DeleteAnalysisMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAnalysis>>>;
export type DeleteAnalysisMutationError = ErrorType<ErrorResponse>;
/**
* @summary Delete an analysis
*/
export declare const useDeleteAnalysis: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
    id: number;
}, TContext>;
export declare const getGetAnalysisSolutionsUrl: (id: number) => string;
/**
 * @summary Get AI-generated solutions for a specific analysis
 */
export declare const getAnalysisSolutions: (id: number, options?: RequestInit) => Promise<SolutionsResponse>;
export declare const getGetAnalysisSolutionsQueryKey: (id: number) => readonly [`/api/analyses/${number}/solutions`];
export declare const getGetAnalysisSolutionsQueryOptions: <TData = Awaited<ReturnType<typeof getAnalysisSolutions>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisSolutions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalysisSolutions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalysisSolutionsQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalysisSolutions>>>;
export type GetAnalysisSolutionsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get AI-generated solutions for a specific analysis
 */
export declare function useGetAnalysisSolutions<TData = Awaited<ReturnType<typeof getAnalysisSolutions>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisSolutions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAnalysisStatsUrl: () => string;
/**
 * @summary Get statistics across all analyses
 */
export declare const getAnalysisStats: (options?: RequestInit) => Promise<AnalysisStats>;
export declare const getGetAnalysisStatsQueryKey: () => readonly ["/api/analyses/stats"];
export declare const getGetAnalysisStatsQueryOptions: <TData = Awaited<ReturnType<typeof getAnalysisStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalysisStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalysisStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalysisStats>>>;
export type GetAnalysisStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get statistics across all analyses
 */
export declare function useGetAnalysisStats<TData = Awaited<ReturnType<typeof getAnalysisStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map