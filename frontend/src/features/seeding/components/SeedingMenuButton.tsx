import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseOutlined, DownOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, type MenuProps } from 'antd';
import { runSeeding } from '../api';
import { SEEDING_OPTIONS } from '../constants';
import type { SeedingOption, SeedingResult } from '../types';

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.message ?? response.response?.data?.error ?? fallback;
}

function SeedingResultContent({ result }: { result: SeedingResult }) {
  return (
    <div className="space-y-2">
      <p>Ngày giao hàng: <strong>{result.deliveryDate}</strong> · Tổng tạo mới: <strong>{result.totalCreated}</strong></p>
      <ul className="list-disc space-y-1 pl-5">
        {result.locations.map((location) => (
          <li key={location.businessLocationId}>
            <strong>{location.code}</strong> ({location.locationName}): {location.status === 'SEEDED'
              ? `${location.created} lượt — ${location.units.map((unit) => `${unit.displayName} ${unit.created}`).join(', ')}`
              : location.message ?? 'Không tạo được dữ liệu.'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SeedingMenuButton({ role }: { role?: string }) {
  const { modal } = App.useApp();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  async function execute(option: SeedingOption) {
    setRunning(true);
    try {
      const result = await runSeeding(option.type);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['check-in'] });
      const hasIssue = result.locations.some((location) => location.status !== 'SEEDED');
      (hasIssue ? modal.warning : modal.success)({
        title: hasIssue ? 'Seeding hoàn tất một phần' : 'Seeding thành công',
        content: <SeedingResultContent result={result} />,
        okText: 'Đóng',
        width: 560,
      });
    } catch (error) {
      modal.error({ title: 'Seeding thất bại', content: errorMessage(error, 'Không chạy được seeding.'), okText: 'Đóng' });
    } finally {
      setRunning(false);
    }
  }

  function confirm(option: SeedingOption) {
    modal.confirm({
      title: `Bạn có chắc muốn chạy "${option.label}"?`,
      content: option.confirmDescription(role),
      okText: 'Đồng ý',
      cancelText: 'Huỷ bỏ',
      okButtonProps: { danger: true },
      onOk: () => { void execute(option); },
    });
  }

  const items: MenuProps['items'] = SEEDING_OPTIONS.map((option) => ({ key: option.type, label: option.label }));

  return (
    <Dropdown
      trigger={['click']}
      disabled={running}
      menu={{
        items,
        onClick: ({ key }) => {
          const option = SEEDING_OPTIONS.find((item) => item.type === key);
          if (option) confirm(option);
        },
      }}
    >
      <Button color="volcano" variant="solid" icon={<DatabaseOutlined />} loading={running}>
        SEEDING <DownOutlined />
      </Button>
    </Dropdown>
  );
}
