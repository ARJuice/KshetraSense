/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FBF9F6',
          100: '#F6F2EC',
          200: '#ECE5DB',
          300: '#DFD5C7',
          400: '#CEBFAD',
          500: '#B8A48F',
          600: '#9B8670',
          700: '#7B6753',
          800: '#5A4A3B',
          900: '#3D3126',
        },
        evergreen: {
          850: '#17241E',
          900: '#121D18',
          950: '#0C1410',
        },
        ink: {
          DEFAULT: '#19221D',
          muted: '#58655E',
          subtle: '#7E8C84',
          faint: '#A6B2AB',
        },
        sage: {
          50: '#F2F6F4',
          100: '#E2EBE6',
          200: '#C7D8CF',
          300: '#A4C0B2',
          400: '#7DA492',
          500: '#588673',
          600: '#416B5B',
          700: '#335347',
          800: '#263D34',
          900: '#1A2923',
        },
        verdigris: {
          DEFAULT: '#367B6E',
          light: '#4C9B8B',
          dark: '#24594F',
          subtle: '#E6F0EE',
        },
        clay: {
          DEFAULT: '#B95E3C',
          light: '#CD7553',
          dark: '#934426',
          subtle: '#F7EDE8',
        },
        amberGold: {
          DEFAULT: '#C98A2C',
          light: '#DE9F3F',
          dark: '#9E6716',
          subtle: '#FAF3E7',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'instrument': '0 1px 3px rgba(25, 34, 29, 0.08), 0 1px 2px rgba(25, 34, 29, 0.04)',
        'instrument-raised': '0 4px 12px rgba(25, 34, 29, 0.08), 0 1px 3px rgba(25, 34, 29, 0.04)',
        'stage': 'inset 0 2px 6px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}
