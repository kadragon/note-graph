/**
 * Semantic color palette for PDF documents
 * Optimized for print readability and WCAG AAA contrast
 */
export const colors = {
  // Text hierarchy
  text: '#1A1A1A', // 16.75:1 on white (AAA)
  textSecondary: '#4B5563', // 7.44:1 on white (AAA)
  textMuted: '#9CA3AF', // 3.01:1 - decorative only

  // Accent
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',

  // Status
  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  successText: '#065F46', // 7.21:1 on successBg (AAA)

  // Structural
  border: '#E5E7EB',
  headerBg: '#F8FAFC',
  white: '#FFFFFF',
};
