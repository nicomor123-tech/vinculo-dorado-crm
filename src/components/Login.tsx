import { useState } from 'react';
import { HeartHandshake, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #213521 0%, #315031 50%, #3d653d 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e4ae3a, #d4951f)' }}>
            <HeartHandshake className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-white text-xl leading-none">Vínculo Dorado</h1>
            <p className="text-white/40 text-xs mt-0.5">CRM Gerontológico</p>
          </div>
        </div>

        <div>
          <h2 className="font-display text-5xl text-white leading-tight mb-6">
            Cada familia merece<br />encontrar el hogar<br />
            <span style={{ color: '#e4ae3a' }}>perfecto.</span>
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-md">
            Gestiona leads, hogares y propuestas desde un solo lugar. Nunca pierdas un cliente, nunca dejes de hacer seguimiento.
          </p>
        </div>

        <div className="flex items-center gap-8">
          {[
            { n: '100%', label: 'trazabilidad' },
            { n: '0', label: 'leads perdidos' },
            { n: '∞', label: 'seguimiento' },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl text-white">{s.n}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e4ae3a, #d4951f)' }}>
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display text-sage-900 text-xl">Vínculo Dorado</h1>
          </div>

          <h2 className="font-display text-2xl text-sage-900 mb-1">Bienvenido de vuelta</h2>
          <p className="text-sage-500 text-sm mb-7">Ingresa con tus credenciales para continuar</p>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-cream-300 text-sm text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent bg-cream-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sage-700 mb-1.5 uppercase tracking-wide">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-cream-300 text-sm text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent bg-cream-50"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600 transition">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-150 active:scale-95 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: loading ? '#507f50' : 'linear-gradient(135deg, #3d653d, #213521)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : 'Ingresar al CRM'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
