import React, { useState, useEffect, useRef } from 'react';

export interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  animateOn?: 'hover' | 'view' | 'change';
}

const DEFAULT_CHARS = '0123456789ABCDEF•+-#%=~';

/**
 * DecryptedText component adapted from React Bits.
 * Cycles through random glyphs before resolving into real text,
 * perfect for scientific instrument readouts and calibrated badges.
 */
export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 8,
  sequential = true,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = 'text-sage-400 font-mono opacity-80',
  animateOn = 'change',
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isDecrypted, setIsDecrypted] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const previousTextRef = useRef(text);

  const availableChars = useOriginalCharsOnly
    ? Array.from(new Set(text.split(''))).filter((c) => c !== ' ').join('') || DEFAULT_CHARS
    : characters;

  const getRandomChar = () => {
    return availableChars[Math.floor(Math.random() * availableChars.length)];
  };

  const startAnimation = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    setIsDecrypted(false);
    let iteration = 0;
    const textLen = text.length;

    intervalRef.current = window.setInterval(() => {
      iteration++;

      const revealedCount = sequential
        ? Math.floor((iteration / maxIterations) * textLen)
        : Math.min(textLen, iteration);

      const nextChars = text.split('').map((realChar, index) => {
        if (realChar === ' ') return ' ';

        let shouldReveal = false;
        if (revealDirection === 'start') {
          shouldReveal = index < revealedCount;
        } else if (revealDirection === 'end') {
          shouldReveal = index >= textLen - revealedCount;
        } else {
          // center outward
          const center = textLen / 2;
          const dist = Math.abs(index - center);
          shouldReveal = dist < revealedCount / 2;
        }

        if (iteration >= maxIterations || shouldReveal) {
          return realChar;
        }
        return getRandomChar();
      });

      setDisplayText(nextChars.join(''));

      if (iteration >= maxIterations) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayText(text);
        setIsDecrypted(true);
      }
    }, speed);
  };

  useEffect(() => {
    if (animateOn === 'change' && previousTextRef.current !== text) {
      previousTextRef.current = text;
      startAnimation();
    } else {
      setDisplayText(text);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, animateOn]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover') {
      startAnimation();
    }
  };

  return (
    <span
      className={`inline-block ${className} ${!isDecrypted ? encryptedClassName : ''}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText}
    </span>
  );
};
