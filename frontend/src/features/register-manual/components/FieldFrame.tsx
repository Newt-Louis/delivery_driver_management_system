import type { ReactNode } from 'react';
import type { FormState } from '../types';

type FieldFrameProps = {
  field: keyof FormState;
  highlightedField: keyof FormState | null;
  variant?: 'choice' | 'input';
  className?: string;
  children: ReactNode;
};

export default function FieldFrame({
  field,
  highlightedField,
  variant = 'input',
  className = '',
  children,
}: FieldFrameProps) {
  const highlighted = highlightedField === field;
  const highlightClasses = highlighted && variant === 'choice' ? 'bg-red-50' : '';

  return (
    <div
      data-register-field={field}
      className={`${className} scroll-mt-24 rounded-2xl transition-all duration-200 ${highlightClasses}`}
    >
      {children}
    </div>
  );
}
