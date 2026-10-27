/**
 * Ative somente DEPOIS que 20261027193000_price_moderation.sql tiver sido
 * aplicada e os privilégios confirmados no banco real.
 * Não apresentar formulários ou painel quando os RPCs ainda não existem.
 */
export const MODERATION_ENABLED = false;
