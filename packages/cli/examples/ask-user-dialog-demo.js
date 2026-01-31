import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState } from 'react';
import { render, Box, Text } from 'ink';
import { AskUserDialog } from '../src/ui/components/AskUserDialog.js';
import { KeypressProvider } from '../src/ui/contexts/KeypressContext.js';
import { QuestionType } from '@google/gemini-cli-core';
const DEMO_QUESTIONS = [
  {
    question: 'What type of project are you building?',
    header: 'Project Type',
    options: [
      { label: 'Web Application', description: 'React, Next.js, or similar' },
      { label: 'CLI Tool', description: 'Command-line interface with Node.js' },
      { label: 'Library', description: 'NPM package or shared utility' },
    ],
    multiSelect: false,
  },
  {
    question: 'Which features should be enabled?',
    header: 'Features',
    options: [
      { label: 'TypeScript', description: 'Add static typing' },
      { label: 'ESLint', description: 'Add linting and formatting' },
      { label: 'Unit Tests', description: 'Add Vitest setup' },
      { label: 'CI/CD', description: 'Add GitHub Actions' },
    ],
    multiSelect: true,
  },
  {
    question: 'What is the project name?',
    header: 'Name',
    type: QuestionType.TEXT,
    placeholder: 'my-awesome-project',
  },
  {
    question: 'Initialize git repository?',
    header: 'Git',
    type: QuestionType.YESNO,
  },
];
const Demo = () => {
  const [result, setResult] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  if (cancelled) {
    return _jsx(Box, {
      padding: 1,
      children: _jsx(Text, {
        color: 'red',
        children: 'Dialog was cancelled. Project initialization aborted.',
      }),
    });
  }
  if (result) {
    return _jsxs(Box, {
      flexDirection: 'column',
      padding: 1,
      borderStyle: 'single',
      borderColor: 'green',
      children: [
        _jsx(Text, {
          bold: true,
          color: 'green',
          children: 'Success! Project Configuration:',
        }),
        DEMO_QUESTIONS.map((q, i) =>
          _jsxs(
            Box,
            {
              marginTop: 1,
              children: [
                _jsxs(Text, { color: 'gray', children: [q.header, ': '] }),
                _jsx(Text, { children: result[i] || '(not answered)' }),
              ],
            },
            i,
          ),
        ),
        _jsx(Box, {
          marginTop: 1,
          children: _jsx(Text, {
            color: 'dim',
            children: 'Press Ctrl+C to exit',
          }),
        }),
      ],
    });
  }
  return _jsx(KeypressProvider, {
    children: _jsxs(Box, {
      padding: 1,
      flexDirection: 'column',
      children: [
        _jsx(Text, {
          bold: true,
          marginBottom: 1,
          children: 'AskUserDialog Demo',
        }),
        _jsx(AskUserDialog, {
          questions: DEMO_QUESTIONS,
          onSubmit: setResult,
          onCancel: () => setCancelled(true),
        }),
      ],
    }),
  });
};
render(_jsx(Demo, {}));
//# sourceMappingURL=ask-user-dialog-demo.js.map
