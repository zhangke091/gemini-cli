/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { loadGlobalMemory, loadEnvironmentMemory, loadJitSubdirectoryMemory, concatenateInstructions, } from '../utils/memoryDiscovery.js';
import { coreEvents, CoreEvent } from '../utils/events.js';
export class ContextManager {
    loadedPaths = new Set();
    config;
    globalMemory = '';
    environmentMemory = '';
    constructor(config) {
        this.config = config;
    }
    /**
     * Refreshes the memory by reloading global and environment memory.
     */
    async refresh() {
        this.loadedPaths.clear();
        await this.loadGlobalMemory();
        await this.loadEnvironmentMemory();
        this.emitMemoryChanged();
    }
    async loadGlobalMemory() {
        const result = await loadGlobalMemory(this.config.getDebugMode());
        this.markAsLoaded(result.files.map((f) => f.path));
        this.globalMemory = concatenateInstructions(result.files.map((f) => ({ filePath: f.path, content: f.content })), this.config.getWorkingDir());
    }
    async loadEnvironmentMemory() {
        const result = await loadEnvironmentMemory([...this.config.getWorkspaceContext().getDirectories()], this.config.getExtensionLoader(), this.config.getDebugMode());
        this.markAsLoaded(result.files.map((f) => f.path));
        const envMemory = concatenateInstructions(result.files.map((f) => ({ filePath: f.path, content: f.content })), this.config.getWorkingDir());
        const mcpInstructions = this.config.getMcpClientManager()?.getMcpInstructions() || '';
        this.environmentMemory = [envMemory, mcpInstructions.trimStart()]
            .filter(Boolean)
            .join('\n\n');
    }
    /**
     * Discovers and loads context for a specific accessed path (Tier 3 - JIT).
     * Traverses upwards from the accessed path to the project root.
     */
    async discoverContext(accessedPath, trustedRoots) {
        const result = await loadJitSubdirectoryMemory(accessedPath, trustedRoots, this.loadedPaths, this.config.getDebugMode());
        if (result.files.length === 0) {
            return '';
        }
        this.markAsLoaded(result.files.map((f) => f.path));
        return concatenateInstructions(result.files.map((f) => ({ filePath: f.path, content: f.content })), this.config.getWorkingDir());
    }
    emitMemoryChanged() {
        coreEvents.emit(CoreEvent.MemoryChanged, {
            fileCount: this.loadedPaths.size,
        });
    }
    getGlobalMemory() {
        return this.globalMemory;
    }
    getEnvironmentMemory() {
        return this.environmentMemory;
    }
    markAsLoaded(paths) {
        for (const p of paths) {
            this.loadedPaths.add(p);
        }
    }
    getLoadedPaths() {
        return this.loadedPaths;
    }
}
//# sourceMappingURL=contextManager.js.map