// Second Soul — Typography System
// Fonts: We use system fonts with letter-spacing and weight tricks
// to achieve a distinctive "ritual" feel without custom font loading complexity.
// For production, replace with: 'Cormorant Garamond' (display) + 'JetBrains Mono' (data)

export const FONTS = {
  // Display / Titles — ceremonial, serif-adjacent via letterSpacing
  title: {
    fontFamily: 'Georgia',
    letterSpacing: 8,
    textTransform: 'uppercase',
  },
  // Subtitle — spaced sans
  subtitle: {
    fontFamily: 'System',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontWeight: '200',
  },
  // Body — clean, readable
  body: {
    fontFamily: 'System',
    letterSpacing: 0.5,
    fontWeight: '300',
  },
  // Data / Metrics — monospace feel
  mono: {
    fontFamily: Platform?.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2,
  },
  // Caption — whisper-level
  caption: {
    fontFamily: 'System',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '200',
  },
};

import { Platform } from 'react-native';
