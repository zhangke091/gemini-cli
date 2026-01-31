/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config, EditorType, CompletedToolCall, ToolCallRequestInfo } from '@google/gemini-cli-core';
import { type TrackedToolCall as LegacyTrackedToolCall, type TrackedScheduledToolCall, type TrackedValidatingToolCall, type TrackedWaitingToolCall, type TrackedExecutingToolCall, type TrackedCompletedToolCall, type TrackedCancelledToolCall, type MarkToolsAsSubmittedFn, type CancelAllFn } from './useReactToolScheduler.js';
import { type TrackedToolCall as NewTrackedToolCall } from './useToolExecutionScheduler.js';
export type { TrackedScheduledToolCall, TrackedValidatingToolCall, TrackedWaitingToolCall, TrackedExecutingToolCall, TrackedCompletedToolCall, TrackedCancelledToolCall, MarkToolsAsSubmittedFn, CancelAllFn, };
export type TrackedToolCall = LegacyTrackedToolCall | NewTrackedToolCall;
export type ScheduleFn = (request: ToolCallRequestInfo | ToolCallRequestInfo[], signal: AbortSignal) => Promise<void | CompletedToolCall[]>;
export type UseToolSchedulerReturn = [
    TrackedToolCall[],
    ScheduleFn,
    MarkToolsAsSubmittedFn,
    React.Dispatch<React.SetStateAction<TrackedToolCall[]>>,
    CancelAllFn,
    number
];
/**
 * Facade hook that switches between the Legacy and Event-Driven schedulers
 * based on configuration.
 *
 * Note: This conditionally calls hooks, which technically violates the standard
 * Rules of Hooks linting. However, this is safe here because
 * `config.isEventDrivenSchedulerEnabled()` is static for the lifetime of the
 * application session (it essentially acts as a compile-time feature flag).
 */
export declare function useToolScheduler(onComplete: (tools: CompletedToolCall[]) => Promise<void>, config: Config, getPreferredEditor: () => EditorType | undefined): UseToolSchedulerReturn;
