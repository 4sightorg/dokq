export const FocusManager = {
  trapFocus(container: HTMLElement): () => void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },
  returnFocus(): void {
    const previousElement = document.querySelector('[data-previous-focus]') as HTMLElement;
    if (previousElement) {
      previousElement.focus();
      previousElement.removeAttribute('data-previous-focus');
    }
  },
  moveFocus(newElement: HTMLElement): void {
    const currentElement = document.activeElement as HTMLElement;
    if (currentElement) {
      currentElement.setAttribute('data-previous-focus', 'true');
    }
    newElement.focus();
  }
};
export const ScreenReader = {
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  },
  announcePageTitle(title: string): void {
    document.title = title;
    this.announce(`Page loaded: ${title}`);
  },
  announceValidationErrors(errors: string[]): void {
    if (errors.length > 0) {
      this.announce(`Form has ${errors.length} validation error${errors.length > 1 ? 's' : ''}: ${errors.join(', ')}`, 'assertive');
    }
  }
};
export const KeyboardNavigation = {
  handleArrowNavigation(
    items: HTMLElement[],
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right'
  ): number {
    const totalItems = items.length;
    if (totalItems === 0) return -1;
    let newIndex = currentIndex;
    switch (direction) {
      case 'up':
      case 'left':
        newIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
        break;
      case 'down':
      case 'right':
        newIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
        break;
    }
    items[newIndex]?.focus();
    return newIndex;
  },
  handleNumberNavigation(items: HTMLElement[], key: string): void {
    const index = parseInt(key) - 1;
    if (index >= 0 && index < items.length) {
      items[index].focus();
    }
  },
  handleHomeEndNavigation(items: HTMLElement[], key: string): void {
    if (key === 'Home' && items.length > 0) {
      items[0].focus();
    } else if (key === 'End' && items.length > 0) {
      items[items.length - 1].focus();
    }
  }
};
export const ColorContrast = {
  getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },
  getContrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  },
  meetsWCAGRequirements(
    foreground: string,
    background: string,
    level: 'AA' | 'AAA' = 'AA',
    size: 'normal' | 'large' = 'normal'
  ): boolean {
    const fg = this.hexToRgb(foreground);
    const bg = this.hexToRgb(background);
    if (!fg || !bg) return false;
    const l1 = this.getRelativeLuminance(fg.r, fg.g, fg.b);
    const l2 = this.getRelativeLuminance(bg.r, bg.g, bg.b);
    const ratio = this.getContrastRatio(l1, l2);
    const requirements = {
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };
    return ratio >= requirements[level][size];
  },
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
};
export const FormAccessibility = {
  associateLabelWithControl(label: HTMLLabelElement, control: HTMLElement): void {
    const id = control.id || `control-${Math.random().toString(36).substr(2, 9)}`;
    control.id = id;
    label.setAttribute('for', id);
  },
  associateErrorWithControl(error: HTMLElement, control: HTMLElement): void {
    const errorId = error.id || `error-${Math.random().toString(36).substr(2, 9)}`;
    error.id = errorId;
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'assertive');
    control.setAttribute('aria-describedby', errorId);
    control.setAttribute('aria-invalid', 'true');
  },
  removeErrorAssociation(control: HTMLElement): void {
    control.removeAttribute('aria-describedby');
    control.removeAttribute('aria-invalid');
  },
  markRequiredField(control: HTMLElement, label: HTMLLabelElement): void {
    control.setAttribute('aria-required', 'true');
    const requiredText = document.createElement('span');
    requiredText.textContent = ' *';
    requiredText.className = 'required-indicator';
    requiredText.setAttribute('aria-label', 'required');
    label.appendChild(requiredText);
  }
};
export const AnimationAccessibility = {
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  applyReducedMotion(): void {
    if (this.prefersReducedMotion()) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  },
  pauseAnimationsOnHidden(): void {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.setProperty('animation-play-state', 'paused');
        document.body.style.setProperty('transition-play-state', 'paused');
      } else {
        document.body.style.removeProperty('animation-play-state');
        document.body.style.removeProperty('transition-play-state');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
};
export const SkipLinks = {
  createSkipLinks(): void {
    const skipLinks = [
      { href: '#main-content', text: 'Skip to main content' },
      { href: '#navigation', text: 'Skip to navigation' },
      { href: '#footer', text: 'Skip to footer' }
    ];
    const skipContainer = document.createElement('div');
    skipContainer.className = 'skip-links';
    skipContainer.setAttribute('role', 'navigation');
    skipContainer.setAttribute('aria-label', 'Skip links');
    skipLinks.forEach(link => {
      const skipLink = document.createElement('a');
      skipLink.href = link.href;
      skipLink.textContent = link.text;
      skipLink.className = 'skip-link';
      skipContainer.appendChild(skipLink);
    });
    document.body.insertBefore(skipContainer, document.body.firstChild);
  }
}; 