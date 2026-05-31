/*
  # Motor de recordatorios de gestiones + escalamiento

  Agrega a `leads` las columnas que necesita la Edge Function
  `recordatorios-gestiones`:

  - `proxima_contactabilidad` (timestamptz): fecha+hora del próximo contacto
    pactado. La setea el frontend (GestionPanel) al registrar una gestión.
  - `proxima_accion` (text): acción a realizar en ese próximo contacto.
  - `recordatorios_enviados` (int): contador de recordatorios al ejecutivo (0..5).
  - `ultimo_recordatorio` (timestamptz): cuándo se envió el último recordatorio.
  - `escalado_supervision` (bool): true cuando ya se escaló al admin (5to) — se
    deja de recordar hasta que el ejecutivo atienda.
  - `recordatorio_ref` (timestamptz): snapshot de proxima_contactabilidad que el
    motor está siguiendo; si cambia, el motor reinicia los contadores.

  Idempotente (IF NOT EXISTS).
*/

alter table public.leads
  add column if not exists proxima_contactabilidad timestamptz,
  add column if not exists proxima_accion          text,
  add column if not exists recordatorios_enviados   integer not null default 0,
  add column if not exists ultimo_recordatorio      timestamptz,
  add column if not exists escalado_supervision     boolean not null default false,
  add column if not exists recordatorio_ref         timestamptz;

-- Acelera el barrido de pendientes (proxima_contactabilidad vencida).
create index if not exists idx_leads_proxima_contactabilidad
  on public.leads (proxima_contactabilidad)
  where proxima_contactabilidad is not null;
