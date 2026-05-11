export type ThemeName = 'github-light' | 'dracula' | 'nord'

export type Document = {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  theme?: ThemeName
}
