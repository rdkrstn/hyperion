// Legacy naming retained during the Solar Ops -> Hyperion transition.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createInitialSolarOpsState, createSolarOpsActions, type SolarOpsActions, type SolarOpsState } from './solarOpsStore';
import type { Role } from '../types/app';

interface SolarOpsContextValue {
  state: SolarOpsState;
  actions: SolarOpsActions;
  activeRole: Role;
  setActiveRole: (role: Role) => void;
}

const SolarOpsContext = createContext<SolarOpsContextValue | undefined>(undefined);

const storageKey = 'solar-ops-clean-state-v1';

function loadInitialState() {
  if (typeof window === 'undefined') return createInitialSolarOpsState();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return createInitialSolarOpsState();
  try {
    return { ...createInitialSolarOpsState(), ...JSON.parse(raw) } as SolarOpsState;
  } catch {
    return createInitialSolarOpsState();
  }
}

export function SolarOpsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SolarOpsState>(loadInitialState);
  const [activeRole, setActiveRole] = useState<Role>('owner');

  const setPersistedState = (next: SolarOpsState) => {
    setState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  const actions = useMemo(() => createSolarOpsActions(() => state, setPersistedState), [state]);

  return (
    <SolarOpsContext.Provider value={{ state, actions, activeRole, setActiveRole }}>
      {children}
    </SolarOpsContext.Provider>
  );
}

export function useSolarOps() {
  const value = useContext(SolarOpsContext);
  if (!value) throw new Error('useSolarOps must be used inside SolarOpsProvider');
  return value;
}

export function resetSolarOpsLocalState() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(storageKey);
    window.location.reload();
  }
}
