// app/robots.ts — génère automatiquement /robots.txt
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://odyssey.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/trip/', '/profile/'],
        disallow: [
          '/create',       // éditeur — pas à indexer
          '/settings',     // paramètres privés
          '/login',        // page de connexion
          '/api/',         // routes API
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}