import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiCelebrationProps {
  trigger: boolean;
  type?: 'birthday' | 'anniversary' | 'promotion';
}

export default function ConfettiCelebration({ trigger, type = 'birthday' }: ConfettiCelebrationProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;

    const colors = type === 'birthday'
      ? ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff']
      : type === 'anniversary'
      ? ['#667eea', '#764ba2', '#f093fb', '#4facfe']
      : ['#00b894', '#fdcb6e', '#e17055'];

    // Fire from both sides
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
        colors,
        disableForReducedMotion: true,
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55, origin: { x: 0.2, y: 0.7 } });
    fire(0.2, { spread: 60, origin: { x: 0.5, y: 0.5 } });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, origin: { x: 0.8, y: 0.7 } });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { x: 0.5, y: 0.3 } });

    // Reset after delay so it can fire again on next prop change
    const t = setTimeout(() => { firedRef.current = false; }, 5000);
    return () => clearTimeout(t);
  }, [trigger, type]);

  return null; // No DOM - confetti uses canvas overlay
}
