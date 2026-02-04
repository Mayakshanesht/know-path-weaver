import { useMemo } from 'react';

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function usePasswordValidation(password: string): PasswordValidation {
  return useMemo(() => {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }

    // Uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }

    // Lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }

    // Number
    if (!/[0-9]/.test(password)) {
      errors.push('At least one number');
    }

    // Special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('At least one special character (!@#$%^&*)');
    }

    // Calculate strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    const passedChecks = 5 - errors.length;
    
    if (passedChecks >= 5) {
      strength = 'strong';
    } else if (passedChecks >= 3) {
      strength = 'medium';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }, [password]);
}
