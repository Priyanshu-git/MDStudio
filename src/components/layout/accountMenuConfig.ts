import type { ThemeName } from '../../types'

export type AccountMenuView = 'main' | 'theme'

export type ThemeOption = {
  value: ThemeName
  label: string
}

export type ThemeGroup = {
  label: string
  options: ThemeOption[]
}

export const themeGroups: ThemeGroup[] = [
  {
    label: 'Light',
    options: [
      { value: 'github-light', label: 'GitHub Light' },
      { value: 'pastel-mint', label: 'Lavender Frost' },
      { value: 'minimal-ivory', label: 'Minimal Ivory' },
    ],
  },
  {
    label: 'Dark',
    options: [
      { value: 'github-dark', label: 'GitHub Dark' },
      { value: 'one-dark', label: 'One Dark' },
      { value: 'blue-eclipse', label: 'Blue Eclipse' },
    ],
  },
]

export function getSelectedThemeLabel(theme: ThemeName): string {
  return themeGroups.flatMap((group) => group.options).find((option) => option.value === theme)?.label ?? 'Theme'
}
