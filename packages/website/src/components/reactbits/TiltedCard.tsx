import React, { useRef, useState, useCallback } from 'react';
import './TiltedCard.css';

export interface TiltedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxAngle?: number; // max tilt degrees (default 10)
  scale?: number; // hover scale factor (default 1.02)
  glareEnable?: boolean;
  className?: string;
}

export const TiltedCard: React.FC<TiltedCardProps> = ({
  children,
  maxAngle = 10,
  scale = 1.02,
  glareEnable = true,
  className = '',
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rX = ((y - centerY) / centerY) * -maxAngle;
      const rY = ((x - centerX) / centerX) * maxAngle;

      setRotateX(rX);
      setRotateY(rY);

      if (glareEnable) {
        setGlarePosition({
          x: (x / rect.width) * 100,
          y: (y / rect.height) * 100,
        });
      }
    },
    [maxAngle, glareEnable]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`reactbits-tilted-card-perspective ${className}`}
      style={style}
      {...props}
    >
      <div
        className="reactbits-tilted-card-transform"
        style={{
          transform: isHovered
            ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        }}
      >
        {children}
        {glareEnable && (
          <div
            className="reactbits-tilted-glare"
            style={{
              opacity: isHovered ? 0.15 : 0,
              background: `radial-gradient(circle 240px at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.8), transparent 70%)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
