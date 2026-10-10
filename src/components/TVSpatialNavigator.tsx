'use client';

import { useEffect, useRef } from 'react';

import { useTVNavigation } from './TVNavigationContext';

/**
 * TV Spatial Navigation Controller
 * Manages D-Pad (Up, Down, Left, Right) navigation between elements matching `[data-tv-focusable="true"]`.
 * Calculates nearest spatial element and scrolls into viewport center smoothly.
 */
export default function TVSpatialNavigator() {
  const { isTVMode, setIsTVMode } = useTVNavigation();
  const currentFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const getFocusableElements = (): HTMLElement[] => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-tv-focusable="true"]:not([disabled])'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      return elements;
    };

    const findNearest = (
      current: HTMLElement,
      direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
      candidates: HTMLElement[]
    ): HTMLElement | null => {
      const cRect = current.getBoundingClientRect();
      const cCenter = {
        x: cRect.left + cRect.width / 2,
        y: cRect.top + cRect.height / 2,
      };

      let bestCandidate: HTMLElement | null = null;
      let minDistance = Infinity;

      for (const el of candidates) {
        if (el === current) continue;
        const rect = el.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        const dx = center.x - cCenter.x;
        const dy = center.y - cCenter.y;

        // Check if candidate is strictly in the direction
        let isValid = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        if (direction === 'ArrowUp') {
          isValid = dy < -5;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
        } else if (direction === 'ArrowDown') {
          isValid = dy > 5;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
        } else if (direction === 'ArrowLeft') {
          isValid = dx < -5;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
        } else if (direction === 'ArrowRight') {
          isValid = dx > 5;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
        }

        if (isValid) {
          // Weight secondary distance higher to favor straight-line movements
          const distance = primaryDist + secondaryDist * 1.8;
          if (distance < minDistance) {
            minDistance = distance;
            bestCandidate = el;
          }
        }
      }

      return bestCandidate;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
      const isDir = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(dir);

      // If playing in fullscreen video, leave playback hotkeys alone
      const isPlayerFocused =
        document.activeElement?.closest('.art-video-player') ||
        document.fullscreenElement;

      if (!isDir && e.key !== 'Enter') return;

      const candidates = getFocusableElements();
      if (candidates.length === 0) return;

      // Ensure activeElement is recognized
      let current = document.activeElement as HTMLElement | null;
      if (!current || !candidates.includes(current)) {
        current = currentFocusedRef.current;
      }

      if (isDir) {
        // If in player fullscreen, let player own keys
        if (isPlayerFocused) return;

        e.preventDefault();
        if (!isTVMode) setIsTVMode(true);

        if (!current || !candidates.includes(current)) {
          // Focus the first element on screen
          const first = candidates[0];
          first.focus();
          first.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
          currentFocusedRef.current = first;
          return;
        }

        const next = findNearest(current, dir, candidates);
        if (next) {
          next.focus();
          next.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
          currentFocusedRef.current = next;
        }
      } else if (e.key === 'Enter') {
        if (current && candidates.includes(current)) {
          // Trigger click
          current.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isTVMode, setIsTVMode]);

  return null;
}
