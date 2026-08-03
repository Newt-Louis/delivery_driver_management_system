import { useState } from 'react';
import { superadminApi } from '../api';
import type { AppConfigItem } from '../types';
import { EmptyState } from './shared';

function asJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function AppConfigEditor({ item, onDone }: { item: AppConfigItem; onDone: () => void }) {
  const [value, setValue] = useState(asJson(item.value));
  const [error, setError] = useState('');

  async function save() {
    setError('');
    try {
      await superadminApi.updateAppConfig(item.key, { value: JSON.parse(value), description: item.description });
      onDone();
    } catch (err) {
      setError(err instanceof SyntaxError ? 'JSON không hợp lệ.' : 'Không lưu được app config.');
    }
  }

  return (
    <div className="border border-thiso-100 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-thiso-800">{item.key}</div>
          <div className="text-xs text-thiso-400">{item.category}</div>
        </div>
        <div className="flex gap-2">
          {item.isSensitive && <span className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700">Sensitive</span>}
          {!item.isRuntimeEditable && <span className="px-2 py-1 text-xs rounded bg-thiso-100 text-thiso-600">Locked</span>}
        </div>
      </div>
      <textarea className="input w-full font-mono text-xs min-h-36" value={item.masked ? '// masked sensitive value' : value} onChange={(e) => setValue(e.target.value)} disabled={item.masked || !item.isRuntimeEditable} />
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      <button className="btn btn-secondary mt-3" onClick={save} disabled={item.masked || !item.isRuntimeEditable}>Lưu JSON</button>
    </div>
  );
}

export default function AppConfigsTab({ appConfigs, onRefresh }: { appConfigs: AppConfigItem[]; onRefresh: () => void }) {
  if (appConfigs.length === 0) return <EmptyState />;
  return (
    <div className="grid xl:grid-cols-2 gap-4">
      {appConfigs.map((item) => <AppConfigEditor key={item.key} item={item} onDone={onRefresh} />)}
    </div>
  );
}
