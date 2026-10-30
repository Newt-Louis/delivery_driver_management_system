import { useEffect, useRef } from 'react';
import { Button, Flex, Typography } from 'antd';

export function LoadMoreTrigger({ hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => void }) {
  const trigger = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || !trigger.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore();
    }, { rootMargin: '0px 0px 240px 0px' });
    observer.observe(trigger.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;
  return <Flex ref={trigger} vertical align="center" gap="small" className="py-4">
    <Typography.Text type="secondary">Cuộn xuống để xem thêm</Typography.Text>
    <Button onClick={onLoadMore}>Xem thêm 40 dòng</Button>
  </Flex>;
}
