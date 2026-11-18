// Fylls i när Supabase-projektet finns. Den publika nyckeln (anon/publishable)
// är gjord för att ligga i webbsidan. Den hemliga nyckeln (service_role) får
// aldrig hamna här.
export const SUPABASE_URL = 'https://zmgdbcimabemafuhioji.supabase.co';
export const SUPABASE_PUBLIC_KEY = 'sb_publishable_aa--NTfRkU6vqDZUqgXMPw_o2LBJhGI';

// Visas på sidan och i felsökningsloggen, så att det syns om mobilen kör en
// gammal sida ur cachen. Höjs vid varje ändring av webbsidan.
export const VERSION = '2026-11-18.44';
