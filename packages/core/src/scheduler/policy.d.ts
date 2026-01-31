/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type CheckResult } from '../policy/types.js';
import type { Config } from '../config/config.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { type SerializableConfirmationDetails } from '../confirmation-bus/types.js';
import { ToolConfirmationOutcome, type AnyDeclarativeTool } from '../tools/tools.js';
import type { ValidatingToolCall } from './types.js';
/**
 * Queries the system PolicyEngine to determine tool allowance.
 * @returns The PolicyDecision.
 * @throws Error if policy requires ASK_USER but the CLI is non-interactive.
 */
export declare function checkPolicy(toolCall: ValidatingToolCall, config: Config): Promise<CheckResult>;
/**
 * Evaluates the outcome of a user confirmation and dispatches
 * policy config updates.
 */
export declare function updatePolicy(tool: AnyDeclarativeTool, outcome: ToolConfirmationOutcome, confirmationDetails: SerializableConfirmationDetails | undefined, deps: {
    config: Config;
    messageBus: MessageBus;
}): Promise<void>;
