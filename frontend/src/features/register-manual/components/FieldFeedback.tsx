import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

export function FieldHint({ text }: { text: string }) {
  return <Typography.Text type="secondary" className="mt-1 block text-xs">{text}</Typography.Text>;
}

export function FieldError({ text }: { text: string }) {
  return <Typography.Text type="danger" className="mt-2 flex items-center gap-1 text-xs"><ExclamationCircleOutlined />{text}</Typography.Text>;
}
