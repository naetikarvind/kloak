import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface DecryptedTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  speed?: number; // ms per frame (default: 45)
  maxIterations?: number; // how many cycles per character (default: 10)
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  animateOn?: 'mount' | 'hover' | 'both';
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 8,
  sequential = true,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = '',
  animateOn = 'mount',
  ...props
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isScrambling, setIsScrambling] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getNextChar = useCallback(
    (targetChar: string) => {
      if (targetChar === ' ') return ' ';
      if (useOriginalCharsOnly) {
        const available = text.replace(/ /g, '');
        return available[Math.floor(Math.random() * available.length)] || targetChar;
      }
      return characters[Math.floor(Math.random() * characters.length)];
    },
    [characters, text, useOriginalCharsOnly]
  );

  const triggerAnimation = useCallback(() => {
    // Accessibility check: respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(text);
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScrambling(true);

    let currentIteration = 0;
    const totalIterations = sequential ? text.length * 2 : maxIterations;

    intervalRef.current = setInterval(() => {
      currentIteration++;

      setDisplayText(() => {
        return text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            const progressThreshold = sequential
              ? Math.floor((currentIteration / totalIterations) * text.length)
              : Math.floor((currentIteration / maxIterations) * text.length);

            if (revealDirection === 'start' && index < progressThreshold) {
              return char;
            } else if (revealDirection === 'end' && index >= text.length - progressThreshold) {
              return char;
            }
            return getNextChar(char);
          })
          .join('');
      });

      if (currentIteration >= totalIterations) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, speed);
  }, [text, speed, maxIterations, sequential, revealDirection, getNextChar]);

  useEffect(() => {
    if (animateOn === 'mount' || animateOn === 'both') {
      triggerAnimation();
    } else {
      setDisplayText(text);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, animateOn, triggerAnimation]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (animateOn === 'hover' || animateOn === 'both') {
      triggerAnimation();
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <span
      className={`${className} ${isScrambling ? encryptedClassName : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}
      {...props}
    >
      {displayText}
    </span>
  );
};
