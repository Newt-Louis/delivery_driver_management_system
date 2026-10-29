import { theme, type ThemeConfig } from 'antd';
import type { ThemeMode } from '../context/ThemeModeContext';

export const STAFF_HEADER_HEIGHT = 60;

// This is the only place shared UI colour values are declared. In dark mode,
// the primary interaction ramp is a smoke-gray neutral so outline controls,
// selected items and focus rings do not inherit a saturated blue.
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
      ...(isDark ? {
        colorPrimary: '#B6B9BE',
        colorPrimaryHover: '#D8DADC',
        colorPrimaryActive: '#8D9299',
        colorPrimaryBg: '#3D444C',
        colorPrimaryBgHover: '#4A525B',
        colorPrimaryBorder: '#626871',
        colorPrimaryBorderHover: '#B6B9BE',
        controlOutline: 'rgba(216, 218, 220, 0.30)',
      } : {}),
    borderRadius: 12,
    controlHeight: 44,
    controlHeightLG: 48,
      fontFamily: 'var(--app-font-family)',
      fontFamilyCode: 'var(--app-font-family)',
    },
    components: {
      Button: isDark ? {
        // Affirmative solid actions retain Ant's blue in either theme. Default
        // outline controls below stay smoke-gray for the dark surface.
        colorPrimary: '#1677FF',
        colorPrimaryHover: '#4096FF',
        colorPrimaryActive: '#0958D9',
        primaryColor: '#FFFFFF',
        defaultHoverBg: '#343B43',
        defaultHoverColor: '#FFFFFF',
        defaultHoverBorderColor: '#8D9299',
        defaultActiveBg: '#3D444C',
        defaultActiveColor: '#FFFFFF',
        defaultActiveBorderColor: '#B6B9BE',
      } : {},
      Switch: isDark ? {
        // Enabled switches are affirmative controls, so keep their Ant blue
        // instead of inheriting the neutral navigation primary ramp.
        colorPrimary: '#1677FF',
        colorPrimaryHover: '#4096FF',
      } : {},
      Menu: {
        horizontalLineHeight: `${STAFF_HEADER_HEIGHT}px`,
        iconMarginInlineEnd: 8,
      },
    },
  };
}
