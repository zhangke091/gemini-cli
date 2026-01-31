/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CommandModule } from 'yargs';
import type { MCPServerConfig } from '@google/gemini-cli-core';
export declare function getMcpServersFromConfig(): Promise<Record<string, MCPServerConfig>>;
export declare function listMcpServers(): Promise<void>;
export declare const listCommand: CommandModule;
