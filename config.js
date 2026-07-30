/**
 * CONFIGURACIÓN DE SUPABASE
 * La clave publishable/anon es pública y puede usarse en el navegador.
 * Nunca coloques aquí la service_role key.
 */
window.APP_CONFIG = {
  SUPABASE_URL: "https://ulhxoqvwwncbkfquveds.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_o1Mnk5DkGV3Np8dKuj3eXw_QoihK6zG",

  // Solo se usa cuando se escribe un usuario sin @ en el login.
  // Ejemplo: "operativo1" se convierte en "operativo1@utc.local".
  AUTH_EMAIL_DOMAIN: "utc.local"
};
