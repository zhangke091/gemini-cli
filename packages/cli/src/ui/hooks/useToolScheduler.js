/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { useReactToolScheduler, } from './useReactToolScheduler.js';
import { useToolExecutionScheduler, } from './useToolExecutionScheduler.js';
/**
 * Facade hook that switches between the Legacy and Event-Driven schedulers
 * based on configuration.
 *
 * Note: This conditionally calls hooks, which technically violates the standard
 * Rules of Hooks linting. However, this is safe here because
 * `config.isEventDrivenSchedulerEnabled()` is static for the lifetime of the
 * application session (it essentially acts as a compile-time feature flag).
 */
export function useToolScheduler(onComplete, config, getPreferredEditor) {
    const isEventDriven = config.isEventDrivenSchedulerEnabled();
    // Note: We return the hooks directly without casting. They return compatible
    // tuple structures, but use explicit tuple signatures rather than the
    // UseToolSchedulerReturn named type to avoid circular dependencies back to
    // this facade.
    if (isEventDriven) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useToolExecutionScheduler(onComplete, config, getPreferredEditor);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useReactToolScheduler(onComplete, config, getPreferredEditor);
}
//# sourceMappingURL=useToolScheduler.js.map