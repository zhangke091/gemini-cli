/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../../core/contentGenerator.js';
import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  FunctionCall,
  FunctionDeclaration,
  Tool,
} from '@google/genai';
import { debugLogger } from '../../utils/debugLogger.js';

// OpenAI-compatible types for DeepSeek API
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface OpenAIChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DeepSeekConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

/**
 * ContentGenerator implementation for DeepSeek API.
 * Uses OpenAI-compatible API format.
 */
export class DeepSeekContentGenerator implements ContentGenerator {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.deepseek.com';
    this.defaultModel = config.defaultModel || 'deepseek-chat';
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const messages = this.convertToOpenAIMessages(
      request.contents as Content[],
    );
    const tools = this.convertToOpenAITools(
      request.config?.tools as Tool[] | undefined,
    );
    const model = request.model || this.defaultModel;

    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: request.config?.temperature ?? 1,
        top_p: request.config?.topP ?? 1,
        max_tokens: request.config?.maxOutputTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data: OpenAIChatCompletion = await response.json();
    return this.convertToGeminiResponse(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const messages = this.convertToOpenAIMessages(
      request.contents as Content[],
    );
    const tools = this.convertToOpenAITools(
      request.config?.tools as Tool[] | undefined,
    );
    const model = request.model || this.defaultModel;

    // eslint-disable-next-line no-console
    console.error('[DeepSeek] generateContentStream called with model:', model);
    // eslint-disable-next-line no-console
    console.error('[DeepSeek] Messages being sent:');
    for (const msg of messages) {
      // eslint-disable-next-line no-console
      console.error(
        `  [${msg.role}]: ${msg.content?.substring(0, 500) || '(no content)'}${msg.tool_calls ? ' (has tool_calls)' : ''}`,
      );
    }
    debugLogger.debug('DeepSeek stream request:', {
      model,
      messageCount: messages.length,
    });

    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: request.config?.temperature ?? 1,
        top_p: request.config?.topP ?? 1,
        max_tokens: request.config?.maxOutputTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    return this.streamGenerator(reader);
  }

  private async *streamGenerator(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): AsyncGenerator<GenerateContentResponse> {
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    const accumulatedToolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const chunk: OpenAIChatCompletionChunk = JSON.parse(
                  trimmed.slice(6),
                );
                const choice = chunk.choices[0];
                if (choice?.delta?.content) {
                  accumulatedContent += choice.delta.content;
                  yield this.createStreamResponse(choice.delta.content, false);
                }
              } catch {
                // Ignore parse errors for final buffer
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk: OpenAIChatCompletionChunk = JSON.parse(
              trimmed.slice(6),
            );
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Handle text content
            if (delta.content) {
              accumulatedContent += delta.content;
              yield this.createStreamResponse(delta.content, false);
            }

            // Handle tool calls
            if (delta.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const existing = accumulatedToolCalls.get(toolCall.index);
                if (existing) {
                  if (toolCall.function?.arguments) {
                    existing.arguments += toolCall.function.arguments;
                  }
                } else {
                  accumulatedToolCalls.set(toolCall.index, {
                    id: toolCall.id || '',
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || '',
                  });
                }
              }
            }

            // Check for finish reason
            if (choice.finish_reason) {
              // eslint-disable-next-line no-console
              console.error(
                '[DeepSeek] finish_reason:',
                choice.finish_reason,
                'toolCalls:',
                accumulatedToolCalls.size,
              );
              if (
                choice.finish_reason === 'tool_calls' &&
                accumulatedToolCalls.size > 0
              ) {
                // eslint-disable-next-line no-console
                console.error(
                  '[DeepSeek] Yielding tool calls:',
                  Array.from(accumulatedToolCalls.values()).map(
                    (tc) => tc.name,
                  ),
                );
                yield this.createToolCallResponse(
                  accumulatedToolCalls,
                  chunk.usage,
                );
              } else if (
                choice.finish_reason === 'stop' &&
                accumulatedContent
              ) {
                // Send final response with STOP finish reason
                yield this.createFinalResponse(accumulatedContent, chunk.usage);
                accumulatedContent = ''; // Mark as sent
              }
            }
          } catch (e) {
            debugLogger.debug('Failed to parse SSE chunk:', trimmed, e);
          }
        }
      }

      // Handle any remaining content that wasn't finalized (edge case)
      if (accumulatedContent) {
        yield this.createFinalResponse(accumulatedContent, undefined);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // DeepSeek doesn't have a token counting API, so we estimate
    const contents = request.contents as Content[];
    let text = '';
    for (const content of contents) {
      for (const part of content.parts || []) {
        if ('text' in part && part.text) {
          text += part.text;
        }
      }
    }
    // Rough estimate: ~4 characters per token for English
    const totalTokens = Math.ceil(text.length / 4);
    return { totalTokens };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('DeepSeek does not support embedding API');
  }

  private convertToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];
    // Track tool calls to match with responses
    const pendingToolCalls: Map<string, string> = new Map(); // name -> id

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      const role = content.role === 'model' ? 'assistant' : content.role;
      const parts = content.parts || [];

      // Check for function calls first (to track their IDs)
      const functionCalls = parts.filter(
        (p): p is Part & { functionCall: FunctionCall } =>
          'functionCall' in p && p.functionCall !== undefined,
      );

      if (functionCalls.length > 0) {
        const toolCalls = functionCalls.map((fc, idx) => {
          const callId = `call_${i}_${idx}`;
          const name = fc.functionCall.name || '';
          pendingToolCalls.set(name, callId);
          return {
            id: callId,
            type: 'function' as const,
            function: {
              name,
              arguments: JSON.stringify(fc.functionCall.args || {}),
            },
          };
        });

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        });
        continue;
      }

      // Check for function response (tool result)
      const functionResponseParts = parts.filter(
        (
          p,
        ): p is Part & {
          functionResponse: { name: string; response: unknown };
        } => 'functionResponse' in p && p.functionResponse !== undefined,
      );

      if (functionResponseParts.length > 0) {
        for (const frp of functionResponseParts) {
          const name = frp.functionResponse.name;
          // Try to find the matching tool call ID, or generate one
          const toolCallId = pendingToolCalls.get(name) || name;
          messages.push({
            role: 'tool',
            content: JSON.stringify(frp.functionResponse.response),
            tool_call_id: toolCallId,
          });
          pendingToolCalls.delete(name);
        }
        continue;
      }

      // Regular text content
      const textParts = parts
        .filter(
          (p): p is Part & { text: string } =>
            'text' in p && typeof p.text === 'string',
        )
        .map((p) => p.text);

      if (textParts.length > 0) {
        messages.push({
          role: role as 'system' | 'user' | 'assistant',
          content: textParts.join('\n'),
        });
      }
    }

    // If there are pending tool calls without responses, we need to remove them
    // to avoid the "tool_calls must be followed by tool messages" error
    const cleanedMessages: OpenAIMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (
        msg.role === 'assistant' &&
        msg.tool_calls &&
        msg.tool_calls.length > 0
      ) {
        // Check if the next message(s) are tool responses
        const toolCallIds = new Set(msg.tool_calls.map((tc) => tc.id));
        let hasAllResponses = true;
        let j = i + 1;

        while (j < messages.length && messages[j].role === 'tool') {
          const toolMsg = messages[j];
          if (toolMsg.tool_call_id) {
            toolCallIds.delete(toolMsg.tool_call_id);
          }
          j++;
        }

        hasAllResponses = toolCallIds.size === 0;

        if (!hasAllResponses) {
          // Skip this tool_calls message and any partial responses
          // Just add the text content if any
          continue;
        }
      }
      cleanedMessages.push(msg);
    }

    return cleanedMessages;
  }

  private convertToOpenAITools(tools?: Tool[]): OpenAITool[] {
    if (!tools) return [];

    const openAITools: OpenAITool[] = [];

    for (const tool of tools) {
      const functionDeclarations = (
        tool as { functionDeclarations?: FunctionDeclaration[] }
      ).functionDeclarations;
      if (functionDeclarations) {
        for (const fn of functionDeclarations) {
          openAITools.push({
            type: 'function',
            function: {
              name: fn.name || '',
              description: fn.description,
              parameters: fn.parameters as Record<string, unknown> | undefined,
            },
          });
        }
      }
    }

    return openAITools;
  }

  private convertToGeminiResponse(
    data: OpenAIChatCompletion,
  ): GenerateContentResponse {
    const choice = data.choices[0];
    const message = choice?.message;
    const parts: Part[] = [];

    if (message?.content) {
      parts.push({ text: message.content });
    }

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args,
          },
        } as Part);
      }
    }

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: this.mapFinishReason(choice?.finish_reason),
        },
      ],
      usageMetadata: data.usage
        ? {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens,
          }
        : undefined,
    } as unknown as GenerateContentResponse;
  }

  private createStreamResponse(
    text: string,
    isFinal: boolean,
  ): GenerateContentResponse {
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text }],
          },
          finishReason: isFinal ? this.mapFinishReason('stop') : undefined,
        },
      ],
    } as unknown as GenerateContentResponse;
  }

  private createToolCallResponse(
    toolCalls: Map<number, { id: string; name: string; arguments: string }>,
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    },
  ): GenerateContentResponse {
    const parts: Part[] = [];

    for (const [, toolCall] of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.arguments);
      } catch {
        args = {};
      }
      parts.push({
        functionCall: {
          name: toolCall.name,
          args,
        },
      } as Part);
    }

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: this.mapFinishReason('tool_calls'),
        },
      ],
      usageMetadata: usage
        ? {
            promptTokenCount: usage.prompt_tokens,
            candidatesTokenCount: usage.completion_tokens,
            totalTokenCount: usage.total_tokens,
          }
        : undefined,
    } as unknown as GenerateContentResponse;
  }

  private createFinalResponse(
    _text: string,
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    },
  ): GenerateContentResponse {
    // Don't send text again - it was already sent via streaming chunks
    // Just send finish reason and usage metadata
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: '' }],
          },
          finishReason: this.mapFinishReason('stop'),
        },
      ],
      usageMetadata: usage
        ? {
            promptTokenCount: usage.prompt_tokens,
            candidatesTokenCount: usage.completion_tokens,
            totalTokenCount: usage.total_tokens,
          }
        : undefined,
    } as unknown as GenerateContentResponse;
  }

  private mapFinishReason(
    reason: string | null | undefined,
  ): 'STOP' | 'MAX_TOKENS' | 'TOOL_CALLS' | undefined {
    if (!reason) return undefined;
    switch (reason) {
      case 'stop':
        return 'STOP';
      case 'length':
        return 'MAX_TOKENS';
      case 'tool_calls':
        return 'TOOL_CALLS';
      default:
        return 'STOP';
    }
  }
}
