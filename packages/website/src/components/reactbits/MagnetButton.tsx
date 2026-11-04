import React, { useRef, useState, useCallback } from 'react';
import './MagnetButton.css';

export interface MagnetButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  magnetStrength?: number; // max offset in px (default 12)
  className?: string;
  disabled?: boolean;
}

export const MagnetButton: React.FC<MagnetButtonProps> = ({
  children,
  magnetStrength = 12,
  className = '',
  disabled = false,
  style,
  ...props
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !buttonRef.current) return;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      setPosition({
        x: deltaX * magnetStrength,
        y: deltaY * magnetStrength,
      });
    },
    [disabled, magnetStrength]
  );

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`reactbits-magnet-wrap ${className}`}
      style={{
        ...style,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
