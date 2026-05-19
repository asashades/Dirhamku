/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#040720',
        secondary: '#FFB800',
        tertiary: '#1CBDB3',
        light: '#F3F4F6',
        danger: '#EF4444',
        success: '#10B981'
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Montserrat', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
