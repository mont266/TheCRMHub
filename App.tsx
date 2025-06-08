
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import ToolCard from './components/ToolCard';
import { CrmTool, Theme } from './types'; // Import Theme
import { CogIcon, ChartBarIcon, UsersIcon, CalculatorIcon, CloudAlertIcon, BeakerIcon } from './components/icons';
import BrazeThresholdCalculator from './components/tools/BrazeThresholdCalculator';
import UkWeatherPredictor from './components/tools/UkWeatherPredictor';
import TestAnalysisTool from './components/tools/TestAnalysisTool'; // Import the new tool

// Theme type is now imported from types.ts

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme); // Use saved theme if available
    } else {
      setTheme('light'); // Otherwise, default to light mode
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);
  
  const tools: CrmTool[] = [
    {
      id: 'braze-threshold-calculator',
      name: 'Braze Alert Threshold Calculator',
      description: 'Calculate lower and upper alert thresholds for Braze campaigns based on send volume and control group settings.',
      icon: <CalculatorIcon />,
      component: BrazeThresholdCalculator,
    },
    {
      id: 'uk-weather-predictor',
      name: 'UK Weather Warning Predictor',
      description: 'Pulls data for UK counties to predict weather warnings based on wind, rain, and heatwave thresholds.',
      icon: <CloudAlertIcon />,
      component: UkWeatherPredictor,
    },
    {
      id: 'test-analysis-tool',
      name: 'Test Analysis Tool',
      description: 'Analyze A/B test performance, from engagement metrics to commercial impact, across various channels.',
      icon: <BeakerIcon />,
      component: TestAnalysisTool,
      isWorkInProgress: true, // Mark as work in progress
    },
    // {
    //   id: 'data-analyzer',
    //   name: 'Data Analyzer Pro',
    //   description: 'Unlock insights from your CRM data with advanced analytics and visualizations. Identify trends and opportunities.',
    //   icon: <ChartBarIcon />,
    //   action: () => alert('Launching Data Analyzer Pro... (feature coming soon!)'),
    // },
    // {
    //   id: 'campaign-planner',
    //   name: 'Campaign Planner X',
    //   description: 'Strategize and manage your marketing campaigns seamlessly. From ideation to execution tracking.',
    //   icon: <CogIcon />,
    //   action: () => alert('Launching Campaign Planner X... (feature coming soon!)'),
    // },
    // {
    //   id: 'customer-segmenter',
    //   name: 'Audience Segmenter',
    //   description: 'Group your customers into targeted segments for personalized communication and improved engagement.',
    //   icon: <UsersIcon />,
    //   action: () => alert('Launching Audience Segmenter... (feature coming soon!)'),
    // },
    //  {
    //   id: 'pipeline-visualizer',
    //   name: 'Pipeline Visualizer',
    //   description: 'Get a clear view of your sales pipeline, track deal progress, and forecast revenue with interactive charts.',
    //   icon: <ChartBarIcon className="transform rotate-90" />,
    //   action: () => alert('Launching Pipeline Visualizer... (feature coming soon!)'),
    // },
  ];

  const handleLaunchTool = (toolId: string) => {
    const toolToLaunch = tools.find(t => t.id === toolId);
    if (toolToLaunch && toolToLaunch.component) {
      setActiveToolId(toolId);
    } else if (toolToLaunch && toolToLaunch.action) {
        toolToLaunch.action(); // Fallback for older tools
    } else {
      alert('Tool not found or no component configured.');
    }
  };

  const handleCloseTool = () => {
    setActiveToolId(null);
  };

  const ActiveToolComponent = activeToolId ? tools.find(t => t.id === activeToolId)?.component : null;

  const HubContent: React.FC = () => (
    <>
      <section className="text-center mb-12 sm:mb-16">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-crm-text-heading dark:text-crm-dm-text-heading mb-4 transition-colors duration-300">
          Welcome to The CRM Hub
        </h2>
        <p className="text-lg sm:text-xl text-crm-text-muted dark:text-crm-dm-text-muted max-w-3xl mx-auto transition-colors duration-300">
          Your central command for powerful tools designed to elevate your CRM strategy and streamline your daily operations.
        </p>
      </section>

      <section>
        <h3 className="text-2xl sm:text-3xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading mb-8 text-center sm:text-left transition-colors duration-300">
          Available Tools
        </h3>
        {tools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onLaunch={handleLaunchTool} />
            ))}
          </div>
        ) : (
          <div className="text-center text-crm-text-muted dark:text-crm-dm-text-muted py-8 bg-crm-card dark:bg-crm-dm-card rounded-xl shadow-lg">
            <p className="text-xl mb-2">No tools are currently available.</p>
            <p>Check back soon for new additions!</p>
          </div>
        )}
      </section>
      {/* 
      <section className="mt-16 text-center bg-crm-card dark:bg-crm-dm-card p-8 rounded-xl shadow-xl dark:shadow-2xl transition-colors duration-300">
        <h3 className="text-2xl font-semibold text-crm-text-body dark:text-crm-dm-text-body mb-4 transition-colors duration-300">New Tools Coming Soon!</h3>
        <p className="text-crm-text-muted dark:text-crm-dm-text-muted mb-6 max-w-xl mx-auto transition-colors duration-300">
          We're constantly working on innovative solutions to help you succeed. Stay tuned for exciting new additions to The CRM Hub.
        </p>
        <button className="bg-gradient-to-r from-fuchsia-500 via-sky-400 to-violet-500 text-crm-button-text font-semibold py-3 px-6 rounded-lg hover:brightness-110 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent focus:ring-offset-crm-card dark:focus:ring-offset-crm-dm-card">
          Notify Me About Updates
        </button>
      </section>
      */}
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-crm-background dark:bg-crm-dm-background transition-colors duration-300">
      <Header theme={theme} toggleTheme={toggleTheme} onLogoClick={handleCloseTool} />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {ActiveToolComponent ? (
          <ActiveToolComponent onClose={handleCloseTool} theme={theme} />
        ) : (
          <HubContent />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;