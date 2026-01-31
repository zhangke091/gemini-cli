/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// DeepSeek model constants
export const DEEPSEEK_CHAT_MODEL = 'deepseek-chat';
export const DEEPSEEK_CODER_MODEL = 'deepseek-coder';
export const DEEPSEEK_REASONER_MODEL = 'deepseek-reasoner';

export const DEEPSEEK_MODELS = new Set([
  DEEPSEEK_CHAT_MODEL,
  DEEPSEEK_CODER_MODEL,
  DEEPSEEK_REASONER_MODEL,
]);

// Note: isDeepSeekModel is defined in config/models.ts to avoid circular dependencies

/**
 * Get the display name for a DeepSeek model.
 *
 * @param model The model name.
 * @returns The display name.
 */
export function getDeepSeekDisplayString(model: string): string {
  switch (model) {
    case DEEPSEEK_CHAT_MODEL:
      return 'DeepSeek Chat';
    case DEEPSEEK_CODER_MODEL:
      return 'DeepSeek Coder';
    case DEEPSEEK_REASONER_MODEL:
      return 'DeepSeek Reasoner';
    default:
      return model;
  }
}

