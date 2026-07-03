import React from 'react';

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export function EchoNotesLogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Notebook Body */}
      <rect 
        x="15" 
        y="18" 
        width="44" 
        height="50" 
        rx="8" 
        stroke="currentColor" 
        strokeWidth="5.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Notebook Rings (3 rings on top) */}
      <path 
        d="M26 12V22M37 12V22M48 12V22" 
        stroke="currentColor" 
        strokeWidth="5.5" 
        strokeLinecap="round"
      />
      {/* Notebook Lines (5 lines inside) */}
      <path 
        d="M26 31H48M26 39H48M26 47H48M26 55H48M26 63H37" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      {/* Sound Waves on the Right (3 arcs) */}
      {/* Outer arc */}
      <path 
        d="M72 23C81.5 32.5 81.5 48.5 72 58" 
        stroke="currentColor" 
        strokeWidth="5.5" 
        strokeLinecap="round"
      />
      {/* Middle arc */}
      <path 
        d="M66 30C72.5 36.5 72.5 47.5 66 54" 
        stroke="currentColor" 
        strokeWidth="5.5" 
        strokeLinecap="round"
      />
      {/* Inner arc */}
      <path 
        d="M60 37C63.5 40.5 63.5 46.5 60 50" 
        stroke="currentColor" 
        strokeWidth="5.5" 
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EchoNotesLogo({ className = "flex items-center gap-3", iconClassName = "w-9 h-9" }: LogoProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-center text-slate-700 dark:text-slate-300 transition-transform hover:scale-105">
        <EchoNotesLogoIcon className={iconClassName} />
      </div>
      <div>
        <h1 className="text-lg font-sans font-semibold tracking-tight leading-none text-slate-800 dark:text-white">EchoNotes</h1>
        <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-bold">INTELLIGENCE</span>
      </div>
    </div>
  );
}
