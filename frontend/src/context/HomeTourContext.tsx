import { createContext, useContext, useState, type ReactNode } from 'react';

type HomeTourContextValue = {
  selectorOpen: boolean;
  setSelectorOpen: (open: boolean) => void;
  selectionCount: number;
  locationSelected: () => void;
};

const Context = createContext<HomeTourContextValue | null>(null);

export function HomeTourProvider({ children }: { children: ReactNode }) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  return <Context.Provider value={{ selectorOpen, setSelectorOpen, selectionCount, locationSelected: () => setSelectionCount((count) => count + 1) }}>{children}</Context.Provider>;
}

export function useHomeTour() {
  const context = useContext(Context);
  if (!context) throw new Error('HomeTourProvider is missing');
  return context;
}
