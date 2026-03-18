import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src="/mvailogo.png" 
      alt="MeemVa Logo" 
      className={className}
      referrerPolicy="no-referrer"
      onError={(e) => {
        // Fallback to a styled div if image fails to load
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
          const fallback = document.createElement('div');
          fallback.className = "w-full h-full bg-gradient-to-br from-aqua-blue to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs";
          fallback.innerText = "MV";
          parent.appendChild(fallback);
        }
      }}
    />
  );
};
