import React, { useRef, useState, useCallback } from 'react';
import './SpotlightCard.css';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightSize?: number;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(109, 74, 255, 0.18)',
  spotlightSize = 340,
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`reactbits-spotlight-card ${className}`}
      style={
        {
          ...style,
          '--spotlight-x': `${position.x}px`,
          '--spotlight-y': `${position.y}px`,
          '--spotlight-color': spotlightColor,
          '--spotlight-size': `${spotlightSize}px`,
          '--spotlight-opacity': opacity,
        } as React.CSSProperties
      }
      {...props}
    >
      <div className="reactbits-spotlight-glow" />
      <div className="reactbits-spotlight-content">{children}</div>
    </div>
  );
};
