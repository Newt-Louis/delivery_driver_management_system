import type { ReactNode } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Flex, Grid, Select, Space, Typography } from 'antd';

type ResponsiveDataToolbarProps = {
  filters: ReactNode;
  createAction?: ReactNode;
};

export function SearchButton() {
  return <Button type="primary" icon={<SearchOutlined />} aria-label="Tìm kiếm" />;
}

/**
 * Keeps Backoffice collection controls in one predictable layout.  Sorting is
 * intentionally only a reserved Ant Design control until each data set has an
 * approved sort contract.
 */
export default function ResponsiveDataToolbar({ filters, createAction }: ResponsiveDataToolbarProps) {
  const screens = Grid.useBreakpoint();
  const sortControl = (
    <Space orientation="vertical" size={4} className="min-w-52">
      <Typography.Text type="secondary">Sắp xếp</Typography.Text>
      <Select disabled placeholder="Sắp xếp sẽ được bổ sung" aria-label="Sắp xếp sẽ được bổ sung" />
    </Space>
  );

  if (!screens.lg) {
    return (
      <Space orientation="vertical" size="middle" className="w-full">
        <Collapse
          items={[{
            key: 'filters',
            label: 'Bộ lọc',
            children: <Flex vertical gap="middle" className="w-full">{filters}</Flex>,
          }]}
        />
        <Collapse
          items={[{
            key: 'sort-and-create',
            label: createAction ? 'Sắp xếp / Thêm' : 'Sắp xếp',
            children: (
              <Flex vertical gap="middle" className="w-full">
                {sortControl}
                {createAction && <Flex justify="end">{createAction}</Flex>}
              </Flex>
            ),
          }]}
        />
      </Space>
    );
  }

  return (
    <Card size="small">
      <Flex justify="space-between" align="end" gap="middle" wrap="wrap">
        <Flex align="end" gap="middle" wrap="wrap">
          {filters}
        </Flex>
        <Flex align="end" gap="small" className="ml-auto">
          {sortControl}
          {createAction}
        </Flex>
      </Flex>
    </Card>
  );
}
