/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { TestRig } from '@google/gemini-cli-test-utils';
import { createUnauthorizedToolError } from '@google/gemini-cli-core';
export * from '@google/gemini-cli-test-utils';
export function evalTest(policy, evalCase) {
    const fn = async () => {
        const rig = new TestRig();
        const { logDir, sanitizedName } = await prepareLogDir(evalCase.name);
        const activityLogFile = path.join(logDir, `${sanitizedName}.jsonl`);
        const logFile = path.join(logDir, `${sanitizedName}.log`);
        let isSuccess = false;
        try {
            rig.setup(evalCase.name, evalCase.params);
            if (evalCase.files) {
                for (const [filePath, content] of Object.entries(evalCase.files)) {
                    const fullPath = path.join(rig.testDir, filePath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, content);
                }
                const execOptions = { cwd: rig.testDir, stdio: 'inherit' };
                execSync('git init', execOptions);
                execSync('git config user.email "test@example.com"', execOptions);
                execSync('git config user.name "Test User"', execOptions);
                // Temporarily disable the interactive editor and git pager
                // to avoid hanging the tests. It seems the the agent isn't
                // consistently honoring the instructions to avoid interactive
                // commands.
                execSync('git config core.editor "true"', execOptions);
                execSync('git config core.pager "cat"', execOptions);
                execSync('git add .', execOptions);
                execSync('git commit --allow-empty -m "Initial commit"', execOptions);
            }
            const result = await rig.run({
                args: evalCase.prompt,
                approvalMode: evalCase.approvalMode ?? 'yolo',
                env: {
                    GEMINI_CLI_ACTIVITY_LOG_FILE: activityLogFile,
                },
            });
            const unauthorizedErrorPrefix = createUnauthorizedToolError('').split("'")[0];
            if (result.includes(unauthorizedErrorPrefix)) {
                throw new Error('Test failed due to unauthorized tool call in output: ' + result);
            }
            await evalCase.assert(rig, result);
            isSuccess = true;
        }
        finally {
            if (isSuccess) {
                await fs.promises.unlink(activityLogFile).catch((err) => {
                    if (err.code !== 'ENOENT')
                        throw err;
                });
            }
            await fs.promises.writeFile(logFile, JSON.stringify(rig.readToolLogs(), null, 2));
            await rig.cleanup();
        }
    };
    if (policy === 'USUALLY_PASSES' && !process.env['RUN_EVALS']) {
        it.skip(evalCase.name, fn);
    }
    else {
        it(evalCase.name, fn);
    }
}
async function prepareLogDir(name) {
    const logDir = path.resolve(process.cwd(), 'evals/logs');
    await fs.promises.mkdir(logDir, { recursive: true });
    const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return { logDir, sanitizedName };
}
//# sourceMappingURL=test-helper.js.map