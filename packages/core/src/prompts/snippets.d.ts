/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface SystemPromptOptions {
    preamble?: PreambleOptions;
    coreMandates?: CoreMandatesOptions;
    agentContexts?: string;
    agentSkills?: AgentSkillOptions[];
    hookContext?: boolean;
    primaryWorkflows?: PrimaryWorkflowsOptions;
    operationalGuidelines?: OperationalGuidelinesOptions;
    sandbox?: SandboxMode;
    gitRepo?: GitRepoOptions;
    finalReminder?: FinalReminderOptions;
}
export interface PreambleOptions {
    interactive: boolean;
}
export interface CoreMandatesOptions {
    interactive: boolean;
    isGemini3: boolean;
    hasSkills: boolean;
}
export interface PrimaryWorkflowsOptions {
    interactive: boolean;
    enableCodebaseInvestigator: boolean;
    enableWriteTodosTool: boolean;
}
export interface OperationalGuidelinesOptions {
    interactive: boolean;
    isGemini3: boolean;
    enableShellEfficiency: boolean;
}
export type SandboxMode = 'macos-seatbelt' | 'generic' | 'outside';
export interface GitRepoOptions {
    interactive: boolean;
}
export interface FinalReminderOptions {
    readFileToolName: string;
}
export interface ApprovalModePlanOptions {
    planModeToolsList: string;
    plansDir: string;
}
export interface AgentSkillOptions {
    name: string;
    description: string;
    location: string;
}
/**
 * Composes the core system prompt from its constituent subsections.
 * Adheres to the minimal complexity principle by using simple interpolation of function calls.
 */
export declare function getCoreSystemPrompt(options: SystemPromptOptions): string;
/**
 * Wraps the base prompt with user memory and approval mode plans.
 */
export declare function renderFinalShell(basePrompt: string, userMemory?: string, planOptions?: ApprovalModePlanOptions): string;
export declare function renderPreamble(options?: PreambleOptions): string;
export declare function renderCoreMandates(options?: CoreMandatesOptions): string;
export declare function renderAgentContexts(contexts?: string): string;
export declare function renderAgentSkills(skills?: AgentSkillOptions[]): string;
export declare function renderHookContext(enabled?: boolean): string;
export declare function renderPrimaryWorkflows(options?: PrimaryWorkflowsOptions): string;
export declare function renderOperationalGuidelines(options?: OperationalGuidelinesOptions): string;
export declare function renderSandbox(mode?: SandboxMode): string;
export declare function renderGitRepo(options?: GitRepoOptions): string;
export declare function renderFinalReminder(options?: FinalReminderOptions): string;
export declare function renderUserMemory(memory?: string): string;
export declare function renderApprovalModePlan(options?: ApprovalModePlanOptions): string;
/**
 * Provides the system prompt for history compression.
 */
export declare function getCompressionPrompt(): string;
