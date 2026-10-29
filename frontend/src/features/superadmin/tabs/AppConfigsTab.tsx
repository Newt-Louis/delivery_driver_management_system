import { useState } from 'react';
import { Alert, Button, Card, Input, Space, Tag, Typography } from 'antd';
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

  return <Card title={item.key} extra={<Space>{item.isSensitive && <Tag color="warning">Sensitive</Tag>}{!item.isRuntimeEditable && <Tag>Locked</Tag>}</Space>}><Typography.Paragraph type="secondary">{item.category}</Typography.Paragraph><Input.TextArea rows={6} value={item.masked ? '// masked sensitive value' : value} onChange={(e) => setValue(e.target.value)} disabled={item.masked || !item.isRuntimeEditable} />{error && <Alert className="mt-2" type="error" message={error} />}<Button className="mt-3" onClick={save} disabled={item.masked || !item.isRuntimeEditable}>Lưu JSON</Button></Card>;

}

export default function AppConfigsTab({ appConfigs, onRefresh }: { appConfigs: AppConfigItem[]; onRefresh: () => void }) {
  if (appConfigs.length === 0) return <EmptyState />;
  return (
    <div className="grid xl:grid-cols-2 gap-4">
      {appConfigs.map((item) => <AppConfigEditor key={item.key} item={item} onDone={onRefresh} />)}
    </div>
  );
}
