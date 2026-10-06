import { AuthForm } from '../_components/auth-form';
export default function RegisterPage() {
  return <main className="shell"><nav className="nav"><a className="brand" href="/">TwiPay</a></nav><section className="auth-card"><span className="badge">Create your account</span><h1 className="auth-title">Start securely.</h1><p>TwiPay owns your account identity. External providers such as Google are optional sign-in methods, not the system of record.</p><AuthForm mode="register" /></section></main>;
}
