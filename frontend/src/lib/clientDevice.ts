type NavigatorWithUAData = Navigator & { userAgentData?: { mobile?: boolean; platform?: string } };

/**
 * Gợi ý loại thiết bị gửi kèm lượt đăng ký. Điện thoại và máy tính bảng đều
 * tính là mobile; iPadOS tự nhận là Mac nên phải dựa vào màn hình cảm ứng.
 */
export function detectClientMobile(): boolean | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as NavigatorWithUAData;
  const userAgent = nav.userAgent ?? '';
  if (/Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && nav.maxTouchPoints > 1) return true;
  const uaData = nav.userAgentData;
  if (uaData?.platform && /Android|iOS/i.test(uaData.platform)) return true;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  return userAgent ? false : undefined;
}
