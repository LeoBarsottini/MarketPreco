/**
 * Migração 20261027193000_price_moderation.sql aplicada ao banco principal
 * em 27/10/2026, com privilégios e RLS verificados.
 * Revisão de denúncias ainda requer que um administrador atribua papéis
 * de moderador em uma operação autorizada, nunca pelo próprio usuário.
 */
export const MODERATION_ENABLED = true;
