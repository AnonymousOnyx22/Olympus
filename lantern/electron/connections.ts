import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ConnectionProvider, ConnectionStatus } from '../src/types/opencode'
import { supportsSignIn, hasSession } from './browserSignIn'

/**
 * Real API access for Station agents - payments, storefront platforms, marketplaces,
 * fulfillment, marketing, and analytics - kept out of the chat entirely. The user enters a
 * value once here; it is encrypted at rest with the OS's own
 * secret storage (DPAPI on Windows, Keychain on macOS, libsecret on Linux) and only ever
 * decrypted inside the main process, to become an environment variable on a project's own
 * `opencode serve` process. An agent's generated code reads `process.env.STRIPE_SECRET_KEY`
 * (the field's `key` below); it never sees, requests, or transmits the raw value itself, so a
 * free or third-party model provider never receives it as part of the conversation.
 */
export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  // ---- Payments ----------------------------------------------------------------------
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    description: 'Real checkout and payments.',
    fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret key', secret: true, placeholder: 'sk_live_… or sk_test_…' },
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable key', secret: false, placeholder: 'pk_live_… or pk_test_…' },
    ],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'Payments',
    description: 'Accept PayPal and card payments at checkout.',
    fields: [
      { key: 'PAYPAL_CLIENT_ID', label: 'Client ID', secret: false },
      { key: 'PAYPAL_CLIENT_SECRET', label: 'Client secret', secret: true },
    ],
  },
  {
    id: 'square',
    name: 'Square',
    category: 'Payments',
    description: 'In-person and online payments through Square.',
    fields: [
      { key: 'SQUARE_ACCESS_TOKEN', label: 'Access token', secret: true },
      { key: 'SQUARE_LOCATION_ID', label: 'Location ID', secret: false },
    ],
  },
  // ---- Storefront platforms -----------------------------------------------------------
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'Storefront platforms',
    description: 'Push a catalogue to a real Shopify store.',
    fields: [
      { key: 'SHOPIFY_STORE_DOMAIN', label: 'Store domain', secret: false, placeholder: 'your-store.myshopify.com' },
      { key: 'SHOPIFY_ADMIN_ACCESS_TOKEN', label: 'Admin API access token', secret: true },
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'Storefront platforms',
    description: 'Manage products and orders on a WordPress store.',
    fields: [
      { key: 'WOOCOMMERCE_STORE_URL', label: 'Store URL', secret: false, placeholder: 'https://yourstore.com' },
      { key: 'WOOCOMMERCE_CONSUMER_KEY', label: 'Consumer key', secret: true },
      { key: 'WOOCOMMERCE_CONSUMER_SECRET', label: 'Consumer secret', secret: true },
    ],
  },
  {
    id: 'bigcommerce',
    name: 'BigCommerce',
    category: 'Storefront platforms',
    description: 'Push a catalogue to a real BigCommerce store.',
    fields: [
      { key: 'BIGCOMMERCE_STORE_HASH', label: 'Store hash', secret: false },
      { key: 'BIGCOMMERCE_ACCESS_TOKEN', label: 'Access token', secret: true },
    ],
  },
  // ---- Marketplaces ---------------------------------------------------------------------
  {
    id: 'etsy',
    name: 'Etsy',
    category: 'Marketplaces',
    description: 'List products on a real Etsy shop.',
    fields: [
      { key: 'ETSY_API_KEY', label: 'API key (keystring)', secret: true },
      { key: 'ETSY_SHARED_SECRET', label: 'Shared secret', secret: true },
    ],
  },
  {
    id: 'ebay',
    name: 'eBay',
    category: 'Marketplaces',
    description: 'List and manage items on eBay.',
    fields: [
      { key: 'EBAY_CLIENT_ID', label: 'Client ID', secret: false },
      { key: 'EBAY_CLIENT_SECRET', label: 'Client secret', secret: true },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon Seller',
    category: 'Marketplaces',
    description: "List products through Amazon's Selling Partner API.",
    fields: [
      { key: 'AMAZON_SP_CLIENT_ID', label: 'Client ID', secret: false },
      { key: 'AMAZON_SP_CLIENT_SECRET', label: 'Client secret', secret: true },
      { key: 'AMAZON_SP_REFRESH_TOKEN', label: 'Refresh token', secret: true },
    ],
  },
  // ---- Fulfillment & shipping -----------------------------------------------------------
  {
    id: 'printify',
    name: 'Printify',
    category: 'Fulfillment & shipping',
    description: 'Print-on-demand products, fulfilled automatically.',
    fields: [{ key: 'PRINTIFY_API_TOKEN', label: 'API token', secret: true }],
  },
  {
    id: 'printful',
    name: 'Printful',
    category: 'Fulfillment & shipping',
    description: 'Print-on-demand products and order fulfilment.',
    fields: [{ key: 'PRINTFUL_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'shippo',
    name: 'Shippo',
    category: 'Fulfillment & shipping',
    description: 'Real shipping rates and labels.',
    fields: [{ key: 'SHIPPO_API_TOKEN', label: 'API token', secret: true }],
  },
  // ---- Marketing & social -----------------------------------------------------------------
  {
    id: 'pinterest',
    name: 'Pinterest',
    category: 'Marketing & social',
    description: 'Publish pins for a store’s products.',
    fields: [{ key: 'PINTEREST_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },
  {
    id: 'meta',
    name: 'Meta (Facebook & Instagram)',
    category: 'Marketing & social',
    description: 'Post to a Facebook Page or an Instagram shop.',
    fields: [{ key: 'META_PAGE_ACCESS_TOKEN', label: 'Page access token', secret: true }],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Marketing & social',
    description: 'Post content and manage a TikTok Shop.',
    fields: [{ key: 'TIKTOK_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    category: 'Marketing & social',
    description: 'Post updates about the store.',
    fields: [{ key: 'X_BEARER_TOKEN', label: 'Bearer token', secret: true }],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'Marketing & social',
    description: 'Email marketing and customer lists.',
    fields: [
      { key: 'MAILCHIMP_API_KEY', label: 'API key', secret: true },
      { key: 'MAILCHIMP_SERVER_PREFIX', label: 'Server prefix', secret: false, placeholder: 'e.g. us21' },
    ],
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    category: 'Marketing & social',
    description: 'Email and SMS marketing automation.',
    fields: [{ key: 'KLAVIYO_PRIVATE_API_KEY', label: 'Private API key', secret: true }],
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Marketing & social',
    description: 'Post order and sales updates to a Discord server.',
    fields: [{ key: 'DISCORD_WEBHOOK_URL', label: 'Webhook URL', secret: true }],
  },
  // ---- Analytics --------------------------------------------------------------------------
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    category: 'Analytics',
    description: 'Track store traffic and conversions (GA4).',
    fields: [
      { key: 'GA4_MEASUREMENT_ID', label: 'Measurement ID', secret: false, placeholder: 'G-XXXXXXX' },
      { key: 'GA4_API_SECRET', label: 'API secret', secret: true },
    
],
  },

  // ---- Media hosting ---------------------------------------------------------------
  // Listings and pins need a public image URL, so somewhere for generated artwork to live
  // is the first thing an autonomous build actually requires.
  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    category: 'Media hosting',
    description: 'Cheap public image hosting for listings and pins. No egress fees.',
    fields: [
      { key: 'R2_ACCOUNT_ID', label: 'Account ID', secret: false },
      { key: 'R2_ACCESS_KEY_ID', label: 'Access key ID', secret: false },
      { key: 'R2_SECRET_ACCESS_KEY', label: 'Secret access key', secret: true },
      { key: 'R2_BUCKET', label: 'Bucket', secret: false, placeholder: 'listings' },
      { key: 'R2_PUBLIC_URL', label: 'Public base URL', secret: false, placeholder: 'https://cdn.example.com' },
    ],
  },
  {
    id: 'aws-s3',
    name: 'Amazon S3',
    category: 'Media hosting',
    description: 'Image hosting on AWS S3 or any S3-compatible service.',
    fields: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'Access key ID', secret: false },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret access key', secret: true },
      { key: 'AWS_REGION', label: 'Region', secret: false, placeholder: 'us-east-1' },
      { key: 'S3_BUCKET', label: 'Bucket', secret: false },
      { key: 'S3_PUBLIC_URL', label: 'Public base URL', secret: false },
    ],
  },
  {
    id: 'backblaze-b2',
    name: 'Backblaze B2',
    category: 'Media hosting',
    description: 'Low-cost object storage with a native image CDN.',
    fields: [
      { key: 'B2_KEY_ID', label: 'Key ID', secret: false },
      { key: 'B2_APP_KEY', label: 'Application key', secret: true },
      { key: 'B2_BUCKET', label: 'Bucket', secret: false },
    ],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    category: 'Media hosting',
    description: 'Image hosting with resizing and format conversion built in.',
    fields: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud name', secret: false },
      { key: 'CLOUDINARY_API_KEY', label: 'API key', secret: false },
      { key: 'CLOUDINARY_API_SECRET', label: 'API secret', secret: true },
    ],
  },

  // ---- Storefronts -------------------------------------------------------------------
  {
    id: 'gumroad',
    name: 'Gumroad',
    category: 'Storefront platforms',
    description: 'Digital products and downloads. Simplest checkout to integrate.',
    fields: [{ key: 'GUMROAD_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'wix',
    name: 'Wix',
    category: 'Storefront platforms',
    description: 'Build and publish a hosted store.',
    fields: [{ key: 'WIX_API_KEY', label: 'API key', secret: true }, { key: 'WIX_SITE_ID', label: 'Site ID', secret: false }],
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    category: 'Storefront platforms',
    description: 'Commerce on a Squarespace site.',
    fields: [{ key: 'SQUARESPACE_API_TOKEN', label: 'API token', secret: true }],
  },
  {
    id: 'bigcartel',
    name: 'BigCartel',
    category: 'Storefront platforms',
    description: 'A simple storefront for small catalogues.',
    fields: [{ key: 'BIGCARTEL_STORE_ID', label: 'Store ID', secret: false }, { key: 'BIGCARTEL_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },

  // ---- Payments ---------------------------------------------------------------------
  {
    id: 'razorpay',
    name: 'Razorpay',
    category: 'Payments',
    description: 'Payments for India and international customers.',
    fields: [{ key: 'RAZORPAY_KEY_ID', label: 'Key ID', secret: false }, { key: 'RAZORPAY_KEY_SECRET', label: 'Key secret', secret: true }],
  },
  {
    id: 'adyen',
    name: 'Adyen',
    category: 'Payments',
    description: 'Enterprise payment processing across many regions.',
    fields: [{ key: 'ADYEN_API_KEY', label: 'API key', secret: true }, { key: 'ADYEN_MERCHANT_ACCOUNT', label: 'Merchant account', secret: false }],
  },
  {
    id: 'gocardless',
    name: 'GoCardless',
    category: 'Payments',
    description: 'Direct debit, useful for subscriptions and recurring orders.',
    fields: [{ key: 'GOCARDLESS_ACCESS_TOKEN', label: 'Access token', secret: true }, { key: 'GOCARDLESS_ACCOUNT_ID', label: 'Account ID', secret: false }],
  },

  // ---- Shipping ---------------------------------------------------------------------
  {
    id: 'shipstation',
    name: 'ShipStation',
    category: 'Fulfillment & shipping',
    description: 'Shipping labels and order tracking.',
    fields: [{ key: 'SHIPSTATION_API_KEY', label: 'API key', secret: true }, { key: 'SHIPSTATION_API_SECRET', label: 'API secret', secret: true }],
  },
  {
    id: 'easyship',
    name: 'Easyship',
    category: 'Fulfillment & shipping',
    description: 'Compare shipping rates and buy labels across carriers.',
    fields: [{ key: 'EASYSHIP_API_KEY', label: 'API key', secret: true }, { key: 'EASYSHIP_API_SECRET', label: 'API secret', secret: true }],
  },
  {
    id: 'dhl',
    name: 'DHL Express',
    category: 'Fulfillment & shipping',
    description: 'Rate quotes, labels and tracking with DHL.',
    fields: [{ key: 'DHL_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Email ------------------------------------------------------------------------
  {
    id: 'resend',
    name: 'Resend',
    category: 'Email',
    description: 'Send order confirmations and receipts.',
    fields: [{ key: 'RESEND_API_KEY', label: 'API key', secret: true }, { key: 'RESEND_FROM', label: 'From address', secret: false }],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'Email',
    description: 'Transactional and marketing email.',
    fields: [{ key: 'SENDGRID_API_KEY', label: 'API key', secret: true }, { key: 'SENDGRID_FROM', label: 'From address', secret: false }],
  },
  {
    id: 'kit',
    name: 'Kit (ConvertKit)',
    category: 'Email',
    description: 'Creator newsletter and audience growth.',
    fields: [{ key: 'KIT_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Support -----------------------------------------------------------------------
  {
    id: 'crisp',
    name: 'Crisp',
    category: 'Support',
    description: 'Live chat on the storefront.',
    fields: [{ key: 'CRISP_WEBSITE_ID', label: 'Website ID', secret: false }, { key: 'CRISP_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'Support',
    description: 'Customer tickets and order lookups.',
    fields: [{ key: 'ZENDESK_SUBDOMAIN', label: 'Subdomain', secret: false }, { key: 'ZENDESK_EMAIL', label: 'Agent email', secret: false }, { key: 'ZENDESK_API_TOKEN', label: 'API token', secret: true }],
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'Support',
    description: 'Customer messaging and onboarding.',
    fields: [{ key: 'INTERCOM_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },

  // ---- Design assets -----------------------------------------------------------------
  {
    id: 'canva',
    name: 'Canva',
    category: 'Design assets',
    description: 'Design and brand assets for the storefront.',
    fields: [{ key: 'CANVA_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },
  {
    id: 'unsplash',
    name: 'Unsplash',
    category: 'Design assets',
    description: 'Licensed photography for listings and marketing.',
    fields: [{ key: 'UNSPLASH_ACCESS_KEY', label: 'Access key', secret: false }],
  },

  // ---- Analytics ---------------------------------------------------------------------
  {
    id: 'posthog',
    name: 'PostHog',
    category: 'Analytics',
    description: 'Product and store analytics, self-hostable.',
    fields: [{ key: 'POSTHOG_API_KEY', label: 'API key', secret: false }, { key: 'POSTHOG_HOST', label: 'Host', secret: false, placeholder: 'https://eu.posthog.com' }],
  },
  {
    id: 'plausible',
    name: 'Plausible',
    category: 'Analytics',
    description: 'Lightweight private analytics.',
    fields: [{ key: 'PLAUSIBLE_API_KEY', label: 'API key', secret: true }, { key: 'PLAUSIBLE_SITE_ID', label: 'Site ID', secret: false }],
  },
  // ---- Print on demand ---------------------------------------------------------------
  {
    id: 'gelato',
    name: 'Gelato',
    category: 'Print on demand',
    description: 'Art and sticker production with local fulfilment.',
    fields: [{ key: 'GELATO_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'teelaunch',
    name: 'Gelato (legacy Teelaunch)',
    category: 'Print on demand',
    description: 'Print-on-demand fulfilment for stickers and posters.',
    fields: [{ key: 'TEELAUNCH_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'contrado',
    name: 'Contrado',
    category: 'Print on demand',
    description: 'Art prints and wall art fulfilment.',
    fields: [{ key: 'CONTRADO_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'icelolly',
    name: 'icelolly',
    category: 'Print on demand',
    description: 'Print-on-demand for artists and creators.',
    fields: [{ key: 'ICELOLLY_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'redbubble',
    name: 'Redbubble',
    category: 'Print on demand',
    description: 'Marketplace for stickers, shirts and prints.',
    fields: [{ key: 'REDBUBBLE_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Marketplaces -----------------------------------------------------------------
  {
    id: 'sellfy',
    name: 'Sellfy',
    category: 'Marketplaces',
    description: 'Digital downloads and printables.',
    fields: [{ key: 'SELLFY_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'itch-io',
    name: 'itch.io',
    category: 'Marketplaces',
    description: 'Sell games, assets and downloadable things.',
    fields: [{ key: 'ITCH_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'ko-fi',
    name: 'Ko-fi',
    category: 'Marketplaces',
    description: 'Sell digital goods and memberships.',
    fields: [{ key: 'KOFI_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Marketing & social ------------------------------------------------------------
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'Marketing & social',
    description: 'Schedule posts to subreddits you moderate.',
    fields: [{ key: 'REDDIT_CLIENT_ID', label: 'Client ID', secret: false }, { key: 'REDDIT_CLIENT_SECRET', label: 'Client secret', secret: true }, { key: 'REDDIT_SUBREDDIT', label: 'Subreddit', secret: false }],
  },
  {
    id: 'tumblr',
    name: 'Tumblr',
    category: 'Marketing & social',
    description: 'Publish product posts to Tumblr.',
    fields: [{ key: 'TUMBLR_API_KEY', label: 'API key', secret: false }, { key: 'TUMBLR_API_SECRET', label: 'API secret', secret: true }],
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'Marketing & social',
    description: 'Post to Bluesky via the AT Protocol.',
    fields: [{ key: 'BLUESKY_IDENTIFIER', label: 'Handle', secret: false }, { key: 'BLUESKY_APP_PASSWORD', label: 'App password', secret: true }],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'Marketing & social',
    description: 'Upload product and demo videos.',
    fields: [{ key: 'YOUTUBE_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'Marketing & social',
    description: 'Share company and product updates.',
    fields: [{ key: 'LINKEDIN_ACCESS_TOKEN', label: 'Access token', secret: true }, { key: 'LINKEDIN_ORG_ID', label: 'Organisation ID', secret: false }],
  },

  // ---- Payments ----------------------------------------------------------------------
  {
    id: 'klarna',
    name: 'Klarna',
    category: 'Payments',
    description: 'Pay-over-time at checkout.',
    fields: [{ key: 'KLARNA_USERNAME', label: 'API username', secret: false }, { key: 'KLARNA_PASSWORD', label: 'API password', secret: true }],
  },
  {
    id: 'affirm',
    name: 'Affirm',
    category: 'Payments',
    description: 'Split-payment financing at checkout.',
    fields: [{ key: 'AFFIRM_CLIENT_ID', label: 'Client ID', secret: false }, { key: 'AFFIRM_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'revolut',
    name: 'Revolut Merchant',
    category: 'Payments',
    description: 'Card payments through Revolut Business.',
    fields: [{ key: 'REVOLUT_API_KEY', label: 'API key', secret: true }, { key: 'REVOLUT_ACCOUNT_ID', label: 'Account ID', secret: false }],
  },

  // ---- Storefront platforms -----------------------------------------------------------
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'Storefront platforms',
    description: 'Publish and update a Webflow site.',
    fields: [{ key: 'WEBFLOW_API_TOKEN', label: 'API token', secret: true }, { key: 'WEBFLOW_SITE_ID', label: 'Site ID', secret: false }],
  },
  {
    id: 'framer',
    name: 'Framer',
    category: 'Storefront platforms',
    description: 'Publish to a Framer site.',
    fields: [{ key: 'FRAMER_API_TOKEN', label: 'API token', secret: true }],
  },
  {
    id: 'carrd',
    name: 'Carrd',
    category: 'Storefront platforms',
    description: 'Simple single-page storefronts.',
    fields: [{ key: 'CARRD_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Support ----------------------------------------------------------------------
  {
    id: 'tidio',
    name: 'Tidio',
    category: 'Support',
    description: 'Chat bots and live chat for the storefront.',
    fields: [{ key: 'TIDIO_ACCOUNT_ID', label: 'Account ID', secret: false }, { key: 'TIDIO_AUTH_TOKEN', label: 'Auth token', secret: true }],
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    category: 'Support',
    description: 'Support tickets and order lookups.',
    fields: [{ key: 'FRESHDESK_DOMAIN', label: 'Domain', secret: false }, { key: 'FRESHDESK_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'helpscout',
    name: 'Help Scout',
    category: 'Support',
    description: 'Customer conversations tied to orders.',
    fields: [{ key: 'HELPSCOUT_API_TOKEN', label: 'API token', secret: true }],
  },

  // ---- Email -------------------------------------------------------------------------
  {
    id: 'postmark',
    name: 'Postmark',
    category: 'Email',
    description: 'Reliable transactional email for receipts and updates.',
    fields: [{ key: 'POSTMARK_SERVER_TOKEN', label: 'Server token', secret: true }],
  },
  {
    id: 'customerio',
    name: 'Customer.io',
    category: 'Email',
    description: 'Lifecycle email tied to customer behaviour.',
    fields: [{ key: 'CUSTOMERIO_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'brevo',
    name: 'Brevo',
    category: 'Email',
    description: 'Email and SMS marketing from one API.',
    fields: [{ key: 'BREVO_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Fulfillment & shipping ---------------------------------------------------------
  {
    id: 'fedex',
    name: 'FedEx',
    category: 'Fulfillment & shipping',
    description: 'Rate quotes, labels and tracking.',
    fields: [{ key: 'FEDEX_CLIENT_ID', label: 'Client ID', secret: false }, { key: 'FEDEX_CLIENT_SECRET', label: 'Client secret', secret: true }, { key: 'FEDEX_ACCOUNT_NUMBER', label: 'Account number', secret: false }],
  },
  {
    id: 'ups',
    name: 'UPS',
    category: 'Fulfillment & shipping',
    description: 'Rates, labels and shipment tracking.',
    fields: [{ key: 'UPS_CLIENT_ID', label: 'Client ID', secret: false }, { key: 'UPS_CLIENT_SECRET', label: 'Client secret', secret: true }, { key: 'UPS_ACCOUNT_NUMBER', label: 'Account number', secret: false }],
  },
  {
    id: 'shipbob',
    name: 'ShipBob',
    category: 'Fulfillment & shipping',
    description: 'Warehousing and fulfilment for physical goods.',
    fields: [{ key: 'SHIPBOB_ACCESS_TOKEN', label: 'Access token', secret: true }, { key: 'SHIPBOB_STORE_ID', label: 'Store ID', secret: false }],
  },

  // ---- Media hosting ------------------------------------------------------------------
  {
    id: 'bunny-net',
    name: 'Bunny.net',
    category: 'Media hosting',
    description: 'Cheap image and video delivery with an edge CDN.',
    fields: [{ key: 'BUNNY_STORAGE_KEY', label: 'Storage zone key', secret: true }, { key: 'BUNNY_PULL_ZONE_ID', label: 'Pull zone ID', secret: false }],
  },
  {
    id: 'imgbb',
    name: 'ImgBB',
    category: 'Media hosting',
    description: 'Simple image hosting for listing photos.',
    fields: [{ key: 'IMGBB_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'pexels',
    name: 'Pexels',
    category: 'Media hosting',
    description: 'Free stock photography for listings and marketing.',
    fields: [{ key: 'PEXELS_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Design assets -------------------------------------------------------------------
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design assets',
    description: 'Pull brand assets and export artwork.',
    fields: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Access token', secret: true }],
  },
  {
    id: 'shutterstock',
    name: 'Shutterstock',
    category: 'Design assets',
    description: 'Licensed imagery for marketing.',
    fields: [{ key: 'SHUTTERSTOCK_API_KEY', label: 'API key', secret: true }],
  },

  // ---- Analytics ----------------------------------------------------------------------
  {
    id: 'amplitude',
    name: 'Amplitude',
    category: 'Analytics',
    description: 'Product and store behaviour analytics.',
    fields: [{ key: 'AMPLITUDE_API_KEY', label: 'API key', secret: true }],
  },
  {
    id: 'matomo',
    name: 'Matomo',
    category: 'Analytics',
    description: 'Self-hosted analytics you can run yourself.',
    fields: [{ key: 'MATOMO_URL', label: 'Server URL', secret: false }, { key: 'MATOMO_TOKEN', label: 'API token', secret: true }],
  },
  // ---- Site hosting -----------------------------------------------------------------
  // Where a finished store actually goes live. Without one, a store only runs on this computer.
  {
    id: 'netlify',
    name: 'Netlify',
    category: 'Site hosting',
    description: 'Free static hosting with serverless functions. The simplest place to put a store live.',
    fields: [
      { key: 'NETLIFY_AUTH_TOKEN', label: 'Personal access token', secret: true },
      { key: 'NETLIFY_SITE_ID', label: 'Site ID (optional)', secret: false },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Site hosting',
    description: 'Hosting with serverless functions and a generous free tier.',
    fields: [
      { key: 'VERCEL_TOKEN', label: 'Access token', secret: true },
      { key: 'VERCEL_PROJECT_ID', label: 'Project ID (optional)', secret: false },
    ],
  },
  {
    id: 'cloudflare-pages',
    name: 'Cloudflare Pages',
    category: 'Site hosting',
    description: 'Free static hosting on Cloudflare with edge functions.',
    fields: [
      { key: 'CLOUDFLARE_API_TOKEN', label: 'API token', secret: true },
      { key: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID', secret: false },
    ],
  },
  {
    id: 'render',
    name: 'Render',
    category: 'Site hosting',
    description: 'Hosting for a store that needs a small always-on server.',
    fields: [{ key: 'RENDER_API_KEY', label: 'API key', secret: true }],
  },
]

function providerById(id: string): ConnectionProvider | undefined {
  return CONNECTION_PROVIDERS.find((p) => p.id === id)
}

interface StoredConnection {
  /** Non-secret fields are stored as plain strings; secret fields as base64 `safeStorage` blobs. */
  values: Record<string, string>
}
type Store = Record<string, StoredConnection>

const storePath = () => path.join(app.getPath('userData'), 'connections.json')

function load(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), 'utf8')) as unknown
    return raw && typeof raw === 'object' ? (raw as Store) : {}
  } catch {
    return {}
  }
}

function persist(store: Store): void {
  const target = storePath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('This machine has no OS-level secret storage available, so connections cannot be saved securely here.')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(stored: string): string {
  return safeStorage.decryptString(Buffer.from(stored, 'base64'))
}

export function listConnectionStatus(): ConnectionStatus[] {
  const store = load()
  return CONNECTION_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    category: provider.category,
    description: provider.description,
    fields: provider.fields,
    configuredFields: provider.fields.filter((field) => !!store[provider.id]?.values[field.key]).map((field) => field.key),
    supportsBrowserSignIn: supportsSignIn(provider.id),
    browserSessionConnected: hasSession(provider.id),
  }))
}

/** `values[field.key] === ''` clears that one field; an omitted key leaves it untouched. */
export function setConnectionValues(providerId: string, values: Record<string, string>): ConnectionStatus[] {
  const provider = providerById(providerId)
  if (!provider) throw new Error(`Unknown connection: ${providerId}`)
  const store = load()
  const current: StoredConnection = { values: { ...(store[providerId]?.values ?? {}) } }
  for (const field of provider.fields) {
    const raw = values[field.key]
    if (raw === undefined) continue
    if (!raw.trim()) {
      delete current.values[field.key]
      continue
    }
    current.values[field.key] = field.secret ? encrypt(raw.trim()) : raw.trim()
  }
  if (Object.keys(current.values).length) store[providerId] = current
  else delete store[providerId]
  persist(store)
  return listConnectionStatus()
}

export function clearConnection(providerId: string): ConnectionStatus[] {
  const store = load()
  delete store[providerId]
  persist(store)
  return listConnectionStatus()
}

/**
 * Decrypted env vars for the given connections, for one project's `opencode serve` process
 * only. Never sent over IPC - call this in the main process right where a daemon is spawned.
 */
export function envForConnections(connectionIds: string[]): NodeJS.ProcessEnv {
  const store = load()
  const out: NodeJS.ProcessEnv = {}
  for (const id of connectionIds) {
    const provider = providerById(id)
    const stored = store[id]
    if (!provider || !stored) continue
    for (const field of provider.fields) {
      const raw = stored.values[field.key]
      if (!raw) continue
      out[field.key] = field.secret ? decrypt(raw) : raw
    }
  }
  return out
}
