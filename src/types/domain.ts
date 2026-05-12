export type ThemeName =
  | 'github-light'
  | 'dracula'
  | 'lavender-fields'
  | 'blue-eclipse'
  | 'lush-forest'
  | 'ink-wash'
  | 'cherry-blossom'

export type Document = {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  theme?: ThemeName
}
