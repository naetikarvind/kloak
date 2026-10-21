import React from 'react';

interface KloakLogoProps {
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export const KloakLogo: React.FC<KloakLogoProps> = ({
  size = 40,
  className = '',
  withGlow = false,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {withGlow && (
        <div
          className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-xl pointer-events-none"
          style={{ transform: 'scale(1.3)' }}
        />
      )}
      <img
        src="./kloak-logo.png"
        srcSet="./kloak-logo-64.png 64w, ./kloak-logo-256.png 256w, ./kloak-logo.png 1024w"
        sizes={`${size}px`}
        alt="Kloak Logo"
        width={size}
        height={size}
        className="relative z-10 object-contain drop-shadow-md rounded-2xl"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
        }}
        onError={(e) => {
          // Fallback to SVG if PNG fails to load
          const target = e.currentTarget;
          if (target.src.indexOf('kloak-logo.svg') === -1) {
            target.src = './kloak-logo.svg';
          }
        }}
      />
    </div>
  );
};
