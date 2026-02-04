import { usePasswordValidation } from '@/hooks/usePasswordValidation';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const { isValid, errors, strength } = usePasswordValidation(password);

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const strengthColors = {
    weak: 'bg-destructive',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const strengthWidth = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  };

  if (!password) return null;

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              strengthColors[strength],
              strengthWidth[strength]
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Password strength:{' '}
          <span
            className={cn(
              'font-medium',
              strength === 'weak' && 'text-destructive',
              strength === 'medium' && 'text-yellow-500',
              strength === 'strong' && 'text-green-500'
            )}
          >
            {strength}
          </span>
        </p>
      </div>

      {/* Requirements list */}
      {showRequirements && (
        <ul className="space-y-1">
          {requirements.map((req) => (
            <li
              key={req.label}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                req.met ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {req.met ? (
                <Check className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              {req.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
