/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  '#f4f7f4',
          100: '#e6ede6',
          200: '#ccdccc',
          300: '#a3c0a3',
          400: '#739f73',
          500: '#507f50',
          600: '#3d653d',
          700: '#315031',
          800: '#284028',
          900: '#213521',
        },
        gold: {
          50:  '#fdf9ef',
          100: '#faf0d4',
          200: '#f4dea3',
          300: '#ecc76a',
          400: '#e4ae3a',
          500: '#d4951f',
          600: '#b87616',
          700: '#935915',
          800: '#784718',
          900: '#643b19',
        },
        cream: {
          50:  '#fdfcf8',
          100: '#faf7f0',
          200: '#f4ede0',
          300: '#ebdfcb',
        },
        teal: {
          50:  '#effaf8',
          100: '#d7f3ee',
          200: '#b2e6de',
          300: '#80d3c8',
          400: '#4ab8ad',
          500: '#2e9d93',
          600: '#237e76',
          700: '#1f6560',
          800: '#1d514d',
          900: '#1b4340',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        'sidebar': '2px 0 16px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
