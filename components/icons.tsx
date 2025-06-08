import React from 'react';

export interface IconProps {
  className?: string;
}

export const CogIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const ChartBarIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6M21 3h-6a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2z" />
  </svg>
);

export const RocketLaunchIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.951 14.951 0 00-11.924-9.02C3.055 3.213 2 4.304 2 5.642v5.326A3.375 3.375 0 005.375 14.5h4.625a3.375 3.375 0 003.375-3.375V8.011c0-1.336.613-2.57 1.612-3.331l.022-.017c.688-.548 1.518-.918 2.433-1.046a5.25 5.25 0 015.777 5.777c-.128.915-.5 1.745-1.046 2.433l-.017.022c-.76.613-1.995 1.612-3.331 1.612h-2.534Z" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-6.364-.386 1.591-1.591M3 12h2.25m.386-6.364 1.591 1.591M12 12a2.25 2.25 0 0 0-2.25 2.25c0 1.242.94 2.25 2.122 2.25s2.121-1.008 2.121-2.25A2.25 2.25 0 0 0 12 12Z" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);

export const CalculatorIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-4.5 .75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008ZM9.75 6.75h.008v.008H9.75V6.75Zm0 2.25h.008v.008H9.75V9Zm0 2.25h.008v.008H9.75v-.008ZM7.5 6.75h.008v.008H7.5V6.75Zm0 2.25h.008v.008H7.5V9Zm0 2.25h.008v.008H7.5v-.008Zm2.25-4.5h.008v.008H9.75V6.75Zm0 2.25h.008v.008H9.75V9Zm0 2.25h.008v.008H9.75v-.008Zm2.25-4.5h.008v.008h-.008V6.75Zm0 2.25h.008v.008h-.008V9Zm0 2.25h.008v.008h-.008v-.008ZM4.5 19.5h15V4.5H4.5v15Z" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

export const CloudAlertIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

export const XMarkIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const BeakerIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355-.186-.676-.401-.959l-1.198-1.65a1.125 1.125 0 00-1.915 0l-1.198 1.65c-.215.283-.401.604-.401.959v1.43A3.375 3.375 0 008.625 12H7.5V6.75A.75.75 0 018.25 6H10.5a.75.75 0 01.75.75v1.432c0 .355.186.676.401.959l1.198 1.65a1.125 1.125 0 001.915 0l1.198-1.65c.215-.283.401-.604-.401-.959V6.75a.75.75 0 01.75-.75H18a.75.75 0 01.75.75V12h-1.125a3.375 3.375 0 00-3.375-4.473V6.087z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.008v.008H12V12zm0 0H6.75A2.25 2.25 0 004.5 14.25v5.25A2.25 2.25 0 006.75 21.75h10.5A2.25 2.25 0 0019.5 19.5v-5.25A2.25 2.25 0 0017.25 12H12z" />
  </svg>
);