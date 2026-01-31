import { jsx as _jsx } from 'react/jsx-runtime';
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandKind } from './types.js';
import { TriageDuplicates } from '../components/triage/TriageDuplicates.js';
export const oncallCommand = {
  name: 'oncall',
  description: 'Oncall related commands',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [
    {
      name: 'dedup',
      description: 'Triage issues labeled as status/possible-duplicate',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: async (context, args) => {
        const { config } = context.services;
        if (!config) {
          throw new Error('Config not available');
        }
        let limit = 50;
        if (args && args.trim().length > 0) {
          const argArray = args.trim().split(/\s+/);
          const parsedLimit = parseInt(argArray[0], 10);
          if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
          }
        }
        return {
          type: 'custom_dialog',
          component: _jsx(TriageDuplicates, {
            config: config,
            initialLimit: limit,
            onExit: () => context.ui.removeComponent(),
          }),
        };
      },
    },
  ],
};
//# sourceMappingURL=oncallCommand.js.map
