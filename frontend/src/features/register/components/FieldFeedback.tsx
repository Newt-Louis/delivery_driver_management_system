export function FieldHint({ text }: { text: string }) {
  return <p className="text-[11px] text-thiso-400 mt-1 leading-relaxed">{text}</p>;
}

export function FieldError({ text }: { text: string }) {
  return <p className="text-[11px] text-red-500 mt-1 font-medium">⚠ {text}</p>;
}
