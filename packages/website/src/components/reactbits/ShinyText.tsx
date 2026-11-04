import React from 'react';
import './ShinyText.css';

export interface ShinyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  speed?: number; // in seconds, default 4s
  className?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  children,
  disabled = false,
  speed = 4,
  className = '',
  style,
  ...props
}) => {
  return (
    <span
      className={`reactbits-shiny-text ${disabled ? 'disabled' : ''} ${className}`}
      style={
        {
          ...style,
          '--animation-duration': `${speed}s`,
        } as React.CSSProperties
      }
      {...props}
    >
      {text || children}
    </span>
  );
};
