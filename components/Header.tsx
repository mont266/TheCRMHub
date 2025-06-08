
import React from 'react';
import { RocketLaunchIcon, SunIcon, MoonIcon } from './icons';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  return (
    <header className="bg-crm-card dark:bg-crm-dm-card shadow-md sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <RocketLaunchIcon className="h-10 w-10 text-crm-accent" />
            <h1 className="ml-3 text-3xl font-bold text-crm-text-heading dark:text-crm-dm-text-heading">
              The CRM Hub
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-crm-text-muted hover:text-crm-text-heading dark:text-crm-dm-text-muted dark:hover:text-crm-dm-text-heading hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-accent"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <SunIcon className="w-6 h-6" />
            ) : (
              <MoonIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;