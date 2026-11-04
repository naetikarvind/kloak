import React from 'react';
import './StarBorder.css';

export interface StarBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  as: Component = 'div',
  className = '',
  color = '#6D4AFF',
  speed = '6s',
  style,
  ...props
}) => {
  return (
    <Component
      className={`reactbits-star-border-container ${className}`}
      style={
        {
          ...style,
          '--border-color': color,
          '--border-speed': speed,
        } as React.CSSProperties
      }
      {...props}
    >
      <div className="reactbits-star-border-glow" />
      <div className="reactbits-star-border-inner">{children}</div>
    </Component>
  );
};
