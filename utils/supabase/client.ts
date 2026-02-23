import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Initialise le client Supabase pour les composants "client-side"
export const supabase = createClientComponentClient();