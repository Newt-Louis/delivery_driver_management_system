import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UnitConfig } from '../../../lib/types';
import { fetchUnitConfigs } from '../api';
import { defaultFrom, defaultTo } from '../utils';
import type { Tab } from '../types';

export function useReports() {
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [unit, setUnit] = useState('');

  const { data: units = [] } = useQuery<UnitConfig[]>({
    queryKey: ['reports-unit-configs'],
    queryFn: fetchUnitConfigs,
  });

  const unitLabels = useMemo(
    () => Object.fromEntries(units.map((item) => [item.unit, item.shortName || item.displayName || item.unit])),
    [units],
  );

  return { tab, setTab, from, setFrom, to, setTo, unit, setUnit, units, unitLabels };
}
