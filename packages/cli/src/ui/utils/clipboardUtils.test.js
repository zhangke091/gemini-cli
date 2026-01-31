/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach, } from 'vitest';
import * as fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import EventEmitter from 'node:events';
import { Stream } from 'node:stream';
import * as path from 'node:path';
// Mock dependencies BEFORE imports
vi.mock('node:fs/promises');
vi.mock('node:fs', () => ({
    createWriteStream: vi.fn(),
}));
vi.mock('node:child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        spawn: vi.fn(),
        execSync: vi.fn(),
    };
});
vi.mock('@google/gemini-cli-core', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        spawnAsync: vi.fn(),
        debugLogger: {
            debug: vi.fn(),
            warn: vi.fn(),
        },
        Storage: class {
            getProjectTempDir = vi.fn(() => '/tmp/global');
        },
    };
});
import { spawnAsync } from '@google/gemini-cli-core';
// Keep static imports for stateless functions
import { cleanupOldClipboardImages, splitEscapedPaths, parsePastedPaths, } from './clipboardUtils.js';
describe('clipboardUtils', () => {
    let originalPlatform;
    let originalEnv;
    // Dynamic module instance for stateful functions
    let clipboardUtils;
    beforeEach(async () => {
        vi.resetAllMocks();
        originalPlatform = process.platform;
        originalEnv = process.env;
        process.env = { ...originalEnv };
        // Reset modules to clear internal state (linuxClipboardTool variable)
        vi.resetModules();
        // Dynamically import the module to get a fresh instance for each test
        clipboardUtils = await import('./clipboardUtils.js');
    });
    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
        process.env = originalEnv;
        vi.restoreAllMocks();
    });
    const setPlatform = (platform) => {
        Object.defineProperty(process, 'platform', {
            value: platform,
        });
    };
    describe('clipboardHasImage (Linux)', () => {
        it('should return true when wl-paste shows image type (Wayland)', async () => {
            setPlatform('linux');
            process.env['XDG_SESSION_TYPE'] = 'wayland';
            execSync.mockReturnValue(Buffer.from('')); // command -v succeeds
            spawnAsync.mockResolvedValueOnce({
                stdout: 'image/png\ntext/plain',
            });
            const result = await clipboardUtils.clipboardHasImage();
            expect(result).toBe(true);
            expect(execSync).toHaveBeenCalledWith(expect.stringContaining('wl-paste'), expect.anything());
            expect(spawnAsync).toHaveBeenCalledWith('wl-paste', ['--list-types']);
        });
        it('should return true when xclip shows image type (X11)', async () => {
            setPlatform('linux');
            process.env['XDG_SESSION_TYPE'] = 'x11';
            execSync.mockReturnValue(Buffer.from('')); // command -v succeeds
            spawnAsync.mockResolvedValueOnce({
                stdout: 'image/png\nTARGETS',
            });
            const result = await clipboardUtils.clipboardHasImage();
            expect(result).toBe(true);
            expect(execSync).toHaveBeenCalledWith(expect.stringContaining('xclip'), expect.anything());
            expect(spawnAsync).toHaveBeenCalledWith('xclip', [
                '-selection',
                'clipboard',
                '-t',
                'TARGETS',
                '-o',
            ]);
        });
        it('should return false if tool fails', async () => {
            setPlatform('linux');
            process.env['XDG_SESSION_TYPE'] = 'wayland';
            execSync.mockReturnValue(Buffer.from(''));
            spawnAsync.mockRejectedValueOnce(new Error('wl-paste failed'));
            const result = await clipboardUtils.clipboardHasImage();
            expect(result).toBe(false);
        });
        it('should return false if no image type is found', async () => {
            setPlatform('linux');
            process.env['XDG_SESSION_TYPE'] = 'wayland';
            execSync.mockReturnValue(Buffer.from(''));
            spawnAsync.mockResolvedValueOnce({ stdout: 'text/plain' });
            const result = await clipboardUtils.clipboardHasImage();
            expect(result).toBe(false);
        });
        it('should return false if tool not found', async () => {
            setPlatform('linux');
            process.env['XDG_SESSION_TYPE'] = 'wayland';
            execSync.mockImplementation(() => {
                throw new Error('Command not found');
            });
            const result = await clipboardUtils.clipboardHasImage();
            expect(result).toBe(false);
        });
    });
    describe('saveClipboardImage (Linux)', () => {
        const mockTargetDir = '/tmp/target';
        const mockTempDir = path.join('/tmp/global', 'images');
        beforeEach(() => {
            setPlatform('linux');
            fs.mkdir.mockResolvedValue(undefined);
            fs.unlink.mockResolvedValue(undefined);
        });
        const createMockChildProcess = (shouldSucceed, exitCode = 0) => {
            const child = new EventEmitter();
            child.stdout = new Stream(); // Dummy stream
            child.stdout.pipe = vi.fn();
            // Simulate process execution
            setTimeout(() => {
                if (!shouldSucceed) {
                    child.emit('error', new Error('Spawn failed'));
                }
                else {
                    child.emit('close', exitCode);
                }
            }, 10);
            return child;
        };
        // Helper to prime the internal linuxClipboardTool state
        const primeClipboardTool = async (type, hasImage = true) => {
            process.env['XDG_SESSION_TYPE'] = type;
            execSync.mockReturnValue(Buffer.from(''));
            spawnAsync.mockResolvedValueOnce({
                stdout: hasImage ? 'image/png' : 'text/plain',
            });
            await clipboardUtils.clipboardHasImage();
            spawnAsync.mockClear();
            execSync.mockClear();
        };
        it('should save image using wl-paste if detected', async () => {
            await primeClipboardTool('wayland');
            // Mock fs.stat to return size > 0
            fs.stat.mockResolvedValue({ size: 100, mtimeMs: Date.now() });
            // Mock spawn to return a successful process for wl-paste
            const mockChild = createMockChildProcess(true, 0);
            spawn.mockReturnValueOnce(mockChild);
            // Mock createWriteStream
            const mockStream = new EventEmitter();
            mockStream.writableFinished = false;
            createWriteStream.mockReturnValue(mockStream);
            // Use dynamic instance
            const promise = clipboardUtils.saveClipboardImage(mockTargetDir);
            // Simulate stream finishing successfully BEFORE process closes
            mockStream.writableFinished = true;
            mockStream.emit('finish');
            const result = await promise;
            expect(result).toContain(mockTempDir);
            expect(result).toMatch(/clipboard-\d+\.png$/);
            expect(spawn).toHaveBeenCalledWith('wl-paste', expect.any(Array));
            expect(fs.mkdir).toHaveBeenCalledWith(mockTempDir, { recursive: true });
        });
        it('should return null if wl-paste fails', async () => {
            await primeClipboardTool('wayland');
            // Mock fs.stat to return size > 0
            fs.stat.mockResolvedValue({ size: 100, mtimeMs: Date.now() });
            // wl-paste fails (non-zero exit code)
            const child1 = createMockChildProcess(true, 1);
            spawn.mockReturnValueOnce(child1);
            const mockStream1 = new EventEmitter();
            createWriteStream.mockReturnValueOnce(mockStream1);
            const promise = clipboardUtils.saveClipboardImage(mockTargetDir);
            mockStream1.writableFinished = true;
            mockStream1.emit('finish');
            const result = await promise;
            expect(result).toBe(null);
            // Should NOT try xclip
            expect(spawn).toHaveBeenCalledTimes(1);
        });
        it('should save image using xclip if detected', async () => {
            await primeClipboardTool('x11');
            // Mock fs.stat to return size > 0
            fs.stat.mockResolvedValue({ size: 100, mtimeMs: Date.now() });
            // Mock spawn to return a successful process for xclip
            const mockChild = createMockChildProcess(true, 0);
            spawn.mockReturnValueOnce(mockChild);
            // Mock createWriteStream
            const mockStream = new EventEmitter();
            mockStream.writableFinished = false;
            createWriteStream.mockReturnValue(mockStream);
            const promise = clipboardUtils.saveClipboardImage(mockTargetDir);
            mockStream.writableFinished = true;
            mockStream.emit('finish');
            const result = await promise;
            expect(result).toMatch(/clipboard-\d+\.png$/);
            expect(spawn).toHaveBeenCalledWith('xclip', expect.any(Array));
        });
        it('should return null if tool is not yet detected', async () => {
            // Don't prime the tool
            const result = await clipboardUtils.saveClipboardImage(mockTargetDir);
            expect(result).toBe(null);
            expect(spawn).not.toHaveBeenCalled();
        });
    });
    // Stateless functions continue to use static imports
    describe('cleanupOldClipboardImages', () => {
        const mockTargetDir = '/tmp/target';
        it('should not throw errors', async () => {
            // Should handle missing directories gracefully
            await expect(cleanupOldClipboardImages(mockTargetDir)).resolves.not.toThrow();
        });
        it('should complete without errors on valid directory', async () => {
            await expect(cleanupOldClipboardImages(mockTargetDir)).resolves.not.toThrow();
        });
    });
    describe('splitEscapedPaths', () => {
        it('should return single path when no spaces', () => {
            expect(splitEscapedPaths('/path/to/image.png')).toEqual([
                '/path/to/image.png',
            ]);
        });
        it('should split simple space-separated paths', () => {
            expect(splitEscapedPaths('/img1.png /img2.png')).toEqual([
                '/img1.png',
                '/img2.png',
            ]);
        });
        it('should split three paths', () => {
            expect(splitEscapedPaths('/a.png /b.jpg /c.heic')).toEqual([
                '/a.png',
                '/b.jpg',
                '/c.heic',
            ]);
        });
        it('should preserve escaped spaces within filenames', () => {
            expect(splitEscapedPaths('/my\\ image.png')).toEqual(['/my\\ image.png']);
        });
        it('should handle multiple paths with escaped spaces', () => {
            expect(splitEscapedPaths('/my\\ img1.png /my\\ img2.png')).toEqual([
                '/my\\ img1.png',
                '/my\\ img2.png',
            ]);
        });
        it('should handle path with multiple escaped spaces', () => {
            expect(splitEscapedPaths('/path/to/my\\ cool\\ image.png')).toEqual([
                '/path/to/my\\ cool\\ image.png',
            ]);
        });
        it('should handle multiple consecutive spaces between paths', () => {
            expect(splitEscapedPaths('/img1.png   /img2.png')).toEqual([
                '/img1.png',
                '/img2.png',
            ]);
        });
        it('should handle trailing and leading whitespace', () => {
            expect(splitEscapedPaths('  /img1.png /img2.png  ')).toEqual([
                '/img1.png',
                '/img2.png',
            ]);
        });
        it('should return empty array for empty string', () => {
            expect(splitEscapedPaths('')).toEqual([]);
        });
        it('should return empty array for whitespace only', () => {
            expect(splitEscapedPaths('   ')).toEqual([]);
        });
    });
    describe('parsePastedPaths', () => {
        it('should return null for empty string', () => {
            const result = parsePastedPaths('', () => true);
            expect(result).toBe(null);
        });
        it('should add @ prefix to single valid path', () => {
            const result = parsePastedPaths('/path/to/file.txt', () => true);
            expect(result).toBe('@/path/to/file.txt ');
        });
        it('should return null for single invalid path', () => {
            const result = parsePastedPaths('/path/to/file.txt', () => false);
            expect(result).toBe(null);
        });
        it('should add @ prefix to all valid paths', () => {
            // Use Set to model reality: individual paths exist, combined string doesn't
            const validPaths = new Set(['/path/to/file1.txt', '/path/to/file2.txt']);
            const result = parsePastedPaths('/path/to/file1.txt /path/to/file2.txt', (p) => validPaths.has(p));
            expect(result).toBe('@/path/to/file1.txt @/path/to/file2.txt ');
        });
        it('should only add @ prefix to valid paths', () => {
            const result = parsePastedPaths('/valid/file.txt /invalid/file.jpg', (p) => p.endsWith('.txt'));
            expect(result).toBe('@/valid/file.txt /invalid/file.jpg ');
        });
        it('should return null if no paths are valid', () => {
            const result = parsePastedPaths('/path/to/file1.txt /path/to/file2.txt', () => false);
            expect(result).toBe(null);
        });
        it('should handle paths with escaped spaces', () => {
            // Use Set to model reality: individual paths exist, combined string doesn't
            const validPaths = new Set(['/path/to/my file.txt', '/other/path.txt']);
            const result = parsePastedPaths('/path/to/my\\ file.txt /other/path.txt', (p) => validPaths.has(p));
            expect(result).toBe('@/path/to/my\\ file.txt @/other/path.txt ');
        });
        it('should unescape paths before validation', () => {
            // Use Set to model reality: individual paths exist, combined string doesn't
            const validPaths = new Set(['/my file.txt', '/other.txt']);
            const validatedPaths = [];
            parsePastedPaths('/my\\ file.txt /other.txt', (p) => {
                validatedPaths.push(p);
                return validPaths.has(p);
            });
            // First checks entire string, then individual unescaped segments
            expect(validatedPaths).toEqual([
                '/my\\ file.txt /other.txt',
                '/my file.txt',
                '/other.txt',
            ]);
        });
        it('should handle single path with unescaped spaces from copy-paste', () => {
            const result = parsePastedPaths('/path/to/my file.txt', () => true);
            expect(result).toBe('@/path/to/my\\ file.txt ');
        });
        it('should handle Windows path', () => {
            const result = parsePastedPaths('C:\\Users\\file.txt', () => true);
            expect(result).toBe('@C:\\Users\\file.txt ');
        });
        it('should handle Windows path with unescaped spaces', () => {
            const result = parsePastedPaths('C:\\My Documents\\file.txt', () => true);
            expect(result).toBe('@C:\\My\\ Documents\\file.txt ');
        });
        it('should handle multiple Windows paths', () => {
            const validPaths = new Set(['C:\\file1.txt', 'D:\\file2.txt']);
            const result = parsePastedPaths('C:\\file1.txt D:\\file2.txt', (p) => validPaths.has(p));
            expect(result).toBe('@C:\\file1.txt @D:\\file2.txt ');
        });
        it('should handle Windows UNC path', () => {
            const result = parsePastedPaths('\\\\server\\share\\file.txt', () => true);
            expect(result).toBe('@\\\\server\\share\\file.txt ');
        });
    });
});
//# sourceMappingURL=clipboardUtils.test.js.map