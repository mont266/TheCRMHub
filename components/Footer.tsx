
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-crm-card dark:bg-crm-dm-card mt-auto border-t border-crm-border dark:border-crm-dm-border transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-crm-text-muted dark:text-crm-dm-text-muted">
        <p>&copy; {currentYear} The CRM Hub. All rights reserved.</p>
        <p className="text-sm mt-1">Empowering CRM Professionals.</p>
      </div>
    </footer>
  );
};

export default Footer;