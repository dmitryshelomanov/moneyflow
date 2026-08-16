import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { periodDefaults } from "@/shared/lib/date";

type PeriodRange = {
  from: string;
  to: string;
};

type PeriodContextValue = {
  period: PeriodRange;
  setPeriod: (next: PeriodRange) => void;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

function defaultPeriodRange(): PeriodRange {
  const defaults = periodDefaults();
  return {
    from: defaults.from.slice(0, 10),
    to: defaults.to.slice(0, 10),
  };
}

export function PeriodProvider({ children }: PropsWithChildren) {
  const [period, setPeriod] = useState<PeriodRange>(defaultPeriodRange);
  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod]);
  return (
    <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
  );
}

export function usePeriod() {
  const value = useContext(PeriodContext);
  if (!value) {
    throw new Error("usePeriod must be used inside PeriodProvider");
  }
  return value;
}
