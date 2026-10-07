import './styles.css';
import { BrandProvider } from './_components/brand-provider';
export const metadata = { title: 'TwiPay', description: 'Move, pay, and access essential services with confidence.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><BrandProvider>{children}</BrandProvider></body></html>;
}
