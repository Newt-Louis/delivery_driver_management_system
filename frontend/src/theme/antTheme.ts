import { theme, type ThemeConfig } from 'antd';
import type { ThemeMode } from '../context/ThemeModeContext';

// This is the only place shared UI colour values are declared. Ant Design's
// semantic state colours intentionally remain owned by its algorithms.
export function createAntTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark';

  return {
    cssVar: {
      prefix: 'dqm',
      key: `thiso-${mode}`,
    },
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorBgBase: isDark ? '#2C3239' : '#FFFFFF',
      colorBgLayout: isDark ? '#1F242A' : '#F7F7F8',
      colorBgContainer: isDark ? '#2C3239' : '#FFFFFF',
      colorBgElevated: isDark ? '#343B43' : '#FFFFFF',
      colorFillAlter: isDark ? '#343B43' : '#F7F7F8',
      colorText: isDark ? '#FFFFFF' : '#434850',
      colorTextSecondary: isDark ? '#D8DADC' : '#626871',
      colorTextTertiary: isDark ? '#B6B9BE' : '#8D9299',
      colorBorder: isDark ? '#545C66' : '#D8DADC',
      colorBorderSecondary: isDark ? '#434B54' : '#EDEEEF',
    borderRadius: 12,
    controlHeight: 44,
    controlHeightLG: 48,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontFamilyCode: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    components: {
      Menu: {
        itemHoverBg: isDark ? '#343B43' : '#FFF0B3',
        itemHoverColor: isDark ? '#FFF4CC' : '#434850',
        itemSelectedBg: isDark ? '#343B43' : '#FFF0B3',
        itemSelectedColor: isDark ? '#FFF4CC' : '#434850',
      },
    },
  };
}
