/**
 * Image Hosts Configuration (add your image hosts here)
 */

// Extract Supabase hostname from env variable for avatar storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null;

const staticHosts = [
    {
        protocol: 'https',
        hostname: 'images.unsplash.com',
    },
    {
        protocol: 'https',
        hostname: 'images.pexels.com',
    },
    {
        protocol: 'https',
        hostname: 'images.pixabay.com',
    },
    {
        protocol: 'https',
        hostname: 'img.rocket.new',
    },
];

export const imageHosts = supabaseHostname
    ? [...staticHosts, { protocol: 'https', hostname: supabaseHostname }]
    : staticHosts;
