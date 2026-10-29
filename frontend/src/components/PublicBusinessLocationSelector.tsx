import { useState } from 'react';
import { EnvironmentOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import { usePublicBusinessLocation } from '../context/PublicBusinessLocationContext';
import BusinessLocationSelectorModal from './BusinessLocationSelectorModal';

export default function PublicBusinessLocationSelector() {
  const {
    locations,
    selectedBusinessLocationId,
    selectedBusinessLocation,
    isLoading,
    error,
    selectPublicBusinessLocation,
  } = usePublicBusinessLocation();
  const [open, setOpen] = useState(false);

  function handleSelect(businessLocationId: string) {
    selectPublicBusinessLocation(businessLocationId);
    setOpen(false);
  }

  return (
    <>
      <FloatButton
        type="primary"
        shape="square"
        icon={<EnvironmentOutlined />}
        content={selectedBusinessLocation?.code ?? 'Chọn'}
        tooltip="Chọn khu vực hiển thị"
        onClick={() => setOpen(true)}
        aria-label="Chọn khu vực hiển thị"
      />
      <BusinessLocationSelectorModal
        open={open}
        title="Chọn khu vực"
        description="Chọn BusinessLocation cho dữ liệu hiển thị ở các trang public trên thiết bị này."
        locations={locations}
        currentId={selectedBusinessLocationId}
        loading={isLoading}
        error={error}
        onSelect={handleSelect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
