import { Button } from 'antd';
export default function ExportBtn({ onClick, label = 'Xuất Excel' }: { onClick: () => void; label?: string }) { return <Button onClick={onClick}>{label}</Button>; }
