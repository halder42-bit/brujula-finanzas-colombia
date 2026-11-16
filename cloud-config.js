/* Configuración pública de Supabase para Brújula.
 * 1) Crea un proyecto en https://supabase.com
 * 2) Copia Project URL y Publishable key (o la "anon" pública).
 * 3) Reemplaza los dos valores vacíos aquí y guarda en GitHub.
 *
 * NUNCA coloques aquí service_role, secret key, contraseña o token privado.
 * La seguridad de los registros depende de las políticas RLS de supabase/schema.sql.
 */
window.BRUJULA_CLOUD = Object.freeze({
  url: '',
  publishableKey: ''
});
window.BRUJULA_CLOUD_ENABLED = Boolean(
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(window.BRUJULA_CLOUD.url.trim()) &&
  window.BRUJULA_CLOUD.publishableKey.trim()
);
