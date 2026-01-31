/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  PREVIEW_GEMINI_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_MODEL_AUTO,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
  DEEPSEEK_CHAT_MODEL,
  DEEPSEEK_CODER_MODEL,
  DEEPSEEK_REASONER_MODEL,
  isDeepSeekModel,
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  getDisplayString,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { ThemedGradient } from './ThemedGradient.js';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const [view, setView] = useState<'main' | 'manual'>('main');
  const [persistMode, setPersistMode] = useState(false);

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || DEFAULT_GEMINI_MODEL_AUTO;

  const shouldShowPreviewModels =
    config?.getPreviewFeatures() && config.getHasAccessToPreviewModel();

  // Check if DeepSeek API key is available
  const hasDeepSeekApiKey = !!process.env['DEEPSEEK_API_KEY'];

  const manualModelSelected = useMemo(() => {
    const manualModels = [
      DEFAULT_GEMINI_MODEL,
      DEFAULT_GEMINI_FLASH_MODEL,
      DEFAULT_GEMINI_FLASH_LITE_MODEL,
      PREVIEW_GEMINI_MODEL,
      PREVIEW_GEMINI_FLASH_MODEL,
      // DeepSeek models
      DEEPSEEK_CHAT_MODEL,
      DEEPSEEK_CODER_MODEL,
      DEEPSEEK_REASONER_MODEL,
    ];
    if (manualModels.includes(preferredModel)) {
      return preferredModel;
    }
    return '';
  }, [preferredModel]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (view === 'manual') {
          setView('main');
        } else {
          onClose();
        }
        return true;
      }
      if (key.name === 'tab') {
        setPersistMode((prev) => !prev);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  const mainOptions = useMemo(() => {
    const list = [
      {
        value: DEFAULT_GEMINI_MODEL_AUTO,
        title: getDisplayString(DEFAULT_GEMINI_MODEL_AUTO),
        description:
          'Let Gemini CLI decide the best model for the task: gemini-2.5-pro, gemini-2.5-flash',
        key: DEFAULT_GEMINI_MODEL_AUTO,
      },
      {
        value: 'Manual',
        title: manualModelSelected
          ? `Manual (${manualModelSelected})`
          : 'Manual',
        description: 'Manually select a model',
        key: 'Manual',
      },
    ];

    if (shouldShowPreviewModels) {
      list.unshift({
        value: PREVIEW_GEMINI_MODEL_AUTO,
        title: getDisplayString(PREVIEW_GEMINI_MODEL_AUTO),
        description:
          'Let Gemini CLI decide the best model for the task: gemini-3-pro, gemini-3-flash',
        key: PREVIEW_GEMINI_MODEL_AUTO,
      });
    }
    return list;
  }, [shouldShowPreviewModels, manualModelSelected]);

  const manualOptions = useMemo(() => {
    const list = [
      {
        value: DEFAULT_GEMINI_MODEL,
        title: DEFAULT_GEMINI_MODEL,
        key: DEFAULT_GEMINI_MODEL,
      },
      {
        value: DEFAULT_GEMINI_FLASH_MODEL,
        title: DEFAULT_GEMINI_FLASH_MODEL,
        key: DEFAULT_GEMINI_FLASH_MODEL,
      },
      {
        value: DEFAULT_GEMINI_FLASH_LITE_MODEL,
        title: DEFAULT_GEMINI_FLASH_LITE_MODEL,
        key: DEFAULT_GEMINI_FLASH_LITE_MODEL,
      },
    ];

    if (shouldShowPreviewModels) {
      list.unshift(
        {
          value: PREVIEW_GEMINI_MODEL,
          title: PREVIEW_GEMINI_MODEL,
          key: PREVIEW_GEMINI_MODEL,
        },
        {
          value: PREVIEW_GEMINI_FLASH_MODEL,
          title: PREVIEW_GEMINI_FLASH_MODEL,
          key: PREVIEW_GEMINI_FLASH_MODEL,
        },
      );
    }

    // Add DeepSeek models if API key is available
    if (hasDeepSeekApiKey) {
      list.push(
        {
          value: DEEPSEEK_CHAT_MODEL,
          title: getDisplayString(DEEPSEEK_CHAT_MODEL),
          key: DEEPSEEK_CHAT_MODEL,
        },
        {
          value: DEEPSEEK_CODER_MODEL,
          title: getDisplayString(DEEPSEEK_CODER_MODEL),
          key: DEEPSEEK_CODER_MODEL,
        },
        {
          value: DEEPSEEK_REASONER_MODEL,
          title: getDisplayString(DEEPSEEK_REASONER_MODEL),
          key: DEEPSEEK_REASONER_MODEL,
        },
      );
    }

    return list;
  }, [shouldShowPreviewModels, hasDeepSeekApiKey]);

  const options = view === 'main' ? mainOptions : manualOptions;

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(() => {
    const idx = options.findIndex((option) => option.value === preferredModel);
    if (idx !== -1) {
      return idx;
    }
    if (view === 'main') {
      const manualIdx = options.findIndex((o) => o.value === 'Manual');
      return manualIdx !== -1 ? manualIdx : 0;
    }
    return 0;
  }, [preferredModel, options, view]);

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    async (model: string) => {
      if (model === 'Manual') {
        setView('manual');
        return;
      }

      if (config) {
        // If switching to/from DeepSeek model, need to refresh auth
        const currentModel = config.getModel();
        const isCurrentDeepSeek = isDeepSeekModel(currentModel);
        const isNewDeepSeek = isDeepSeekModel(model);

        if (isNewDeepSeek && !isCurrentDeepSeek) {
          // Switching to DeepSeek - need to refresh auth with DeepSeek type
          config.setModel(model, persistMode ? false : true);
          await config.refreshAuth(AuthType.USE_DEEPSEEK);
        } else if (!isNewDeepSeek && isCurrentDeepSeek) {
          // Switching from DeepSeek to Gemini - need to refresh auth
          config.setModel(model, persistMode ? false : true);
          // Default back to Gemini API key if available, otherwise Google login
          const hasGeminiKey = !!process.env['GEMINI_API_KEY'];
          await config.refreshAuth(hasGeminiKey ? AuthType.USE_GEMINI : AuthType.LOGIN_WITH_GOOGLE);
        } else {
          config.setModel(model, persistMode ? false : true);
        }

        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose, persistMode],
  );

  let header;
  let subheader;

  // Do not show any header or subheader since it's already showing preview model
  // options
  if (shouldShowPreviewModels) {
    header = undefined;
    subheader = undefined;
    // When a user has the access but has not enabled the preview features.
  } else if (config?.getHasAccessToPreviewModel()) {
    header = 'Gemini 3 is now available.';
    subheader =
      'Enable "Preview features" in /settings.\nLearn more at https://goo.gle/enable-preview-features';
  } else {
    header = 'Gemini 3 is coming soon.';
    subheader = undefined;
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>

      <Box flexDirection="column">
        {header && (
          <Box marginTop={1}>
            <ThemedGradient>
              <Text>{header}</Text>
            </ThemedGradient>
          </Box>
        )}
        {subheader && <Text>{subheader}</Text>}
      </Box>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={options}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.text.primary}>
            Remember model for future sessions:{' '}
          </Text>
          <Text color={theme.status.success}>
            {persistMode ? 'true' : 'false'}
          </Text>
        </Box>
        <Text color={theme.text.secondary}>(Press Tab to toggle)</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {'> To use a specific Gemini model on startup, use the --model flag.'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
