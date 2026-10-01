import type { ThemeConfig } from 'antd';

// The only location where neutral palette values are declared. Semantic colours
// intentionally remain Ant Design defaults.
export const antTheme: ThemeConfig = {
  cssVar: {
    prefix: 'dqm',
    key: 'smoke-gray',
  },
  token: {
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F7F7F8',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorFillAlter: '#F7F7F8',
    colorText: '#434850',
    colorTextSecondary: '#626871',
    colorTextTertiary: '#8D9299',
    colorBorder: '#D8DADC',
    colorBorderSecondary: '#EDEEEF',
    borderRadius: 12,
    controlHeight: 44,
    controlHeightLG: 48,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};
