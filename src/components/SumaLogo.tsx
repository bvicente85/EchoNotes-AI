import React from 'react';
import sumaLogoIcon from './suma_logo_icon.png';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  isDarkBg?: boolean;
}

export function SumaLogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <img 
      src={sumaLogoIcon} 
      alt="SUMA Icon" 
      className={className} 
      style={{ objectFit: 'contain' }}
    />
  );
}

export function SumaLogo({ className = "flex items-center gap-3", iconClassName = "w-9 h-9", isDarkBg = false }: LogoProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-center transition-transform hover:scale-105 shrink-0">
        <img 
          src={sumaLogoIcon} 
          alt="SUMA Logo" 
          className={iconClassName}
          style={{ objectFit: 'contain' }}
        />
      </div>
      <div className="text-left leading-none">
        <h1 className={isDarkBg ? "text-lg font-sans font-black tracking-tight leading-none text-white" : "text-lg font-sans font-black tracking-tight leading-none text-slate-900 dark:text-white"}>
          SUMA
        </h1>
        <span className={isDarkBg ? "text-[8px] font-mono text-slate-400 uppercase tracking-[0.2em] font-bold block mt-0.5" : "text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-bold block mt-0.5"}>
          Summarize
        </span>
      </div>
    </div>
  );
}
