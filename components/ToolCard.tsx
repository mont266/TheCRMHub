
import React from 'react';
import { CrmTool } from '../types';
import { IconProps } from './icons'; // Import IconProps

interface ToolCardProps {
  tool: CrmTool;
  onLaunch: (toolId: string) => void; // Callback to launch the tool
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onLaunch }) => {
  const handleLaunch = () => {
    if (tool.component) {
      onLaunch(tool.id);
    } else if (tool.action) {
      tool.action(); // Fallback for old tools or simple actions
    }
  };

  return (
    <div className="bg-crm-card dark:bg-crm-dm-card rounded-xl shadow-lg dark:shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col">
      <div className="p-6 flex-grow">
        <div className="flex items-center mb-4">
          <div className="p-3 rounded-full bg-crm-icon-bg dark:bg-crm-dm-icon-bg mr-4 transition-colors duration-300">
            {React.cloneElement(tool.icon as React.ReactElement<IconProps>, { className: "w-8 h-8 text-crm-accent" })}
          </div>
          <h3 className="text-xl font-semibold text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300">{tool.name}</h3>
        </div>
        <p className="text-crm-text-muted dark:text-crm-dm-text-muted text-sm mb-4 leading-relaxed transition-colors duration-300">
          {tool.description}
        </p>
      </div>
      <div className="p-6 bg-crm-card-footer-bg dark:bg-crm-dm-card-footer-bg border-t border-crm-border dark:border-crm-dm-border transition-colors duration-300">
        <button
          onClick={handleLaunch}
          className="w-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-violet-500 text-crm-button-text font-semibold py-3 px-4 rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent focus:ring-offset-crm-card-footer-bg dark:focus:ring-offset-crm-dm-card-footer-bg transition-all duration-300 flex items-center justify-center"
          aria-label={`Launch ${tool.name}`}
        >
          Launch Tool
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ToolCard;
