/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
/**
 * Orchestrates prompt generation by gathering context and building options.
 */
export declare class PromptProvider {
    /**
     * Generates the core system prompt.
     */
    getCoreSystemPrompt(config: Config, userMemory?: string, interactiveOverride?: boolean): string;
    getCompressionPrompt(): string;
    private withSection;
    private maybeWriteSystemMd;
}
