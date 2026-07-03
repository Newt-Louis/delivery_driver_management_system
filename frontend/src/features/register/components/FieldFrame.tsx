import type { ReactNode } from 'react';
import type { FormState } from '../types';

type FieldFrameProps = {
  field: keyof FormState;
  highlightedField: keyof FormState | null;
  className?: string;
  children: ReactNode;
};

export default function FieldFrame({ field, highlightedField, className = '', children }: FieldFrameProps) {
  const highlighted = highlightedField === field;

  return (
    <div
      data-register-field={field}
      className={`${className} scroll-mt-24 rounded-2xl transition-all duration-200 ${
        highlighted ? 'ring-2 ring-red-300 ring-offset-4 ring-offset-red-50' : ''
      }`}
    >
      {children}
    </div>
  );
}
