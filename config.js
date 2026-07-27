/**
 * CONFIGURACIÓN GENERAL
 *
 * SUPABASE_URL: Project URL de Supabase.
 * SUPABASE_ANON_KEY: clave pública "anon" o "publishable".
 * NUNCA pegues aquí la contraseña de tu cuenta ni la service_role key.
 */
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Usuarios TEMPORALES para revisar el diseño antes de activar Supabase.
  // Cambia estas contraseñas antes de publicar o deja LOCAL_USERS vacío al activar el login real.
  LOCAL_USERS: [
    { username: "administrador", password: "UTC-Admin-2026!", name: "Administrador", role: "admin", initials: "AR" },
    { username: "operativo1", password: "UTC-Operativo1-2026!", name: "Operativo 1", role: "operativo", initials: "O1" },
    { username: "operativo2", password: "UTC-Operativo2-2026!", name: "Operativo 2", role: "operativo", initials: "O2" },
    { username: "operativo3", password: "UTC-Operativo3-2026!", name: "Operativo 3", role: "operativo", initials: "O3" }
  ]
};
