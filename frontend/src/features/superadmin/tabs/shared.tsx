import type { ReactNode } from 'react';
import { Empty, Tag } from 'antd';
export function StatusBadge({ active }: { active?: boolean }) { return <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>; }
export function EmptyState({ text = 'Chưa có dữ liệu.' }: { text?: string }) { return <Empty description={text} />; }
export function TableShell({ children }: { children: ReactNode }) { return <div className="overflow-x-auto">{children}</div>; }
