import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="40" height="40" rx="10" fill="url(#logoGrad)" />
      <path
        d="M12 28V16L20 12L28 16V28L20 24L12 28Z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M20 12V24"
        stroke="white"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#00D4FF" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default AppLogo;
