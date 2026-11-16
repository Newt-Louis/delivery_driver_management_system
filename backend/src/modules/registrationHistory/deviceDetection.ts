import { RegistrationDeviceType } from '@prisma/client';

const USER_AGENT_MAX_LENGTH = 512;
// Điện thoại và máy tính bảng đều xếp vào MOBILE theo yêu cầu nghiệp vụ.
const MOBILE_USER_AGENT = /Mobi|Android|iPhone|iPad|iPod|Tablet|Windows Phone|IEMobile|Opera Mini|Silk|Kindle/i;

export type RegistrationRequestContext = {
  userAgent?: string | null;
  /** Header `Sec-CH-UA-Mobile` do trình duyệt nhân Chromium gửi: `?1` hoặc `?0`. */
  clientHintMobile?: string | null;
  /** Gợi ý từ frontend (nhận được cả iPadOS tự nhận là Mac). */
  clientMobile?: boolean;
};

export function truncateUserAgent(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, USER_AGENT_MAX_LENGTH) : null;
}

export function detectRegistrationDevice(context: RegistrationRequestContext = {}): RegistrationDeviceType | null {
  if (typeof context.clientMobile === 'boolean') {
    return context.clientMobile ? RegistrationDeviceType.MOBILE : RegistrationDeviceType.DESKTOP;
  }
  const userAgent = context.userAgent?.trim();
  if (userAgent && MOBILE_USER_AGENT.test(userAgent)) return RegistrationDeviceType.MOBILE;
  if (context.clientHintMobile?.trim() === '?1') return RegistrationDeviceType.MOBILE;
  if (userAgent || context.clientHintMobile?.trim() === '?0') return RegistrationDeviceType.DESKTOP;
  return null;
}
