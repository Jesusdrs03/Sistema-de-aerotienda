import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Aerotienda',
  description: 'Gestión de pedidos, entregas y stock de la Aerotienda',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
