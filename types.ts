import React from 'react';

export type Theme = 'light' | 'dark';

export interface ToolProps {
  onClose: () => void; // Function to signal closing the tool view
  theme: Theme; // Current theme
}

export interface CrmTool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  component?: React.FC<ToolProps>; // Optional: The React component for the tool
  action?: () => void; // Kept for tools without a dedicated component (or for quick actions)
  isWorkInProgress?: boolean; // Optional: Flag for tools under development
}