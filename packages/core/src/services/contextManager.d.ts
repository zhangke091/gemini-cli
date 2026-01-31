/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
export declare class ContextManager {
    private readonly loadedPaths;
    private readonly config;
    private globalMemory;
    private environmentMemory;
    constructor(config: Config);
    /**
     * Refreshes the memory by reloading global and environment memory.
     */
    refresh(): Promise<void>;
    private loadGlobalMemory;
    private loadEnvironmentMemory;
    /**
     * Discovers and loads context for a specific accessed path (Tier 3 - JIT).
     * Traverses upwards from the accessed path to the project root.
     */
    discoverContext(accessedPath: string, trustedRoots: string[]): Promise<string>;
    private emitMemoryChanged;
    getGlobalMemory(): string;
    getEnvironmentMemory(): string;
    private markAsLoaded;
    getLoadedPaths(): ReadonlySet<string>;
}
