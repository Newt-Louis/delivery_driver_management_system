import type { ReactNode } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import type { SortDir } from '../types';
interface SortHeaderProps<T extends string> { field: T; label: string; sortField: T; sortDir: SortDir; onSort: (field: T) => void; }
export function SortHeader<T extends string>({ field, label, sortField, sortDir, onSort }: SortHeaderProps<T>) { return <Button type="link" style={{ padding: 0 }} onClick={() => onSort(field)}>{label}{sortField === field ? ` (${sortDir === 'asc' ? 'tăng' : 'giảm'})` : ''}</Button>; }
export function CellHeader({ label }: { label: string }) { return <span>{label}</span>; }
export function Pagination({ page, pages, total, onPageChange }: { page: number; pages: number; total: number; onPageChange: (page: number) => void }) { if (pages <= 1) return null; return <Space wrap className="mt-3"><Typography.Text>Tổng: {total.toLocaleString()} · Trang {page}/{pages}</Typography.Text><Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Trước</Button><Button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Tiếp</Button></Space>; }
export function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) { if (!data) return null; return <Card size="small" title={label} className="mt-3"><pre style={{ overflow: 'auto', maxHeight: 192 }}>{JSON.stringify(data, null, 2)}</pre></Card>; }
export function EmptyStateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) { return <tr><td colSpan={colSpan}>{children}</td></tr>; }
