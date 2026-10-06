import './styles.css';
export const metadata = { title: 'TwiPay Operations', description: 'Restricted operations console for authorized TwiPay staff.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
