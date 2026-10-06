import { AuthForm } from '../_components/auth-form';
export default function LoginPage() {
  return <main className="shell"><nav className="nav"><a className="brand" href="/">TwiPay</a></nav><section className="auth-card"><span className="badge">Secure sign in</span><h1 className="auth-title">Welcome back.</h1><p>Your TwiPay web session is stored in a secure HttpOnly cookie—not browser localStorage.</p><AuthForm mode="login" /></section></main>;
}
