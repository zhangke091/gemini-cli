import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ApprovalMode } from '@google/gemini-cli-core';
export const ApprovalModeIndicator = ({ approvalMode, }) => {
    let textColor = '';
    let textContent = '';
    let subText = '';
    switch (approvalMode) {
        case ApprovalMode.AUTO_EDIT:
            textColor = theme.status.warning;
            textContent = 'accepting edits';
            subText = ' (shift + tab to cycle)';
            break;
        case ApprovalMode.PLAN:
            textColor = theme.status.success;
            textContent = 'plan mode';
            subText = ' (shift + tab to cycle)';
            break;
        case ApprovalMode.YOLO:
            textColor = theme.status.error;
            textContent = 'YOLO mode';
            subText = ' (ctrl + y to toggle)';
            break;
        case ApprovalMode.DEFAULT:
        default:
            break;
    }
    return (_jsx(Box, { children: _jsxs(Text, { color: textColor, children: [textContent, subText && _jsx(Text, { color: theme.text.secondary, children: subText })] }) }));
};
//# sourceMappingURL=ApprovalModeIndicator.js.map