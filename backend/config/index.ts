import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env / .env.local if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export type AppEnvironment = 'development' | 'production' | 'test';

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === '*' || raw.trim() === '') {
    return ['*'];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function validateEnvironment(): {
  env: AppEnvironment;
  port: number;
  host: string;
  apiPrefix: string;
  cors: {
    allowedOrigins: string[];
    methods: string[];
    credentials: boolean;
  };
  storage: {
    driver: 'local' | 's3';
    localDir: string;
  };
  admin: {
    defaultUsername: string;
    passwordHash: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder: string;
    isConfigured: boolean;
  };
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
} {
  const rawEnv = process.env.NODE_ENV?.toLowerCase() || 'development';
  const env: AppEnvironment = rawEnv === 'production' ? 'production' : rawEnv === 'test' ? 'test' : 'development';

  const rawPort = parseInt(process.env.PORT || '3001', 10);
  const port = isNaN(rawPort) || rawPort <= 0 || rawPort > 65535 ? 3001 : rawPort;

  const host = process.env.HOST || '0.0.0.0';
  const apiPrefix = '/api';

  const allowedOrigins = parseAllowedOrigins();
  const rawStorageDriver = process.env.MEDIA_STORAGE_DRIVER?.toLowerCase();
  const driver: 'local' | 's3' = rawStorageDriver === 's3' ? 's3' : 'local';
  const localDir = process.env.MEDIA_STORAGE_LOCAL_DIR || './data/media';

  const defaultUsername = process.env.ADMIN_DEFAULT_USER || 'admin@nexus.campus';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';

  // Production sanity checks
  if (env === 'production') {
    if (allowedOrigins.includes('*')) {
      console.warn('[Security Warning] CORS is configured with wildcard ("*") in production environment!');
    }
  }

  const cloudinaryCloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME ||
    'plg8gola';
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';
  const cloudinaryFolder =
    process.env.CLOUDINARY_FOLDER ||
    process.env.VITE_CLOUDINARY_FOLDER ||
    'nexus/profile-images';

  return {
    env,
    port,
    host,
    apiPrefix,
    cors: {
      allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    storage: {
      driver,
      localDir,
    },
    admin: {
      defaultUsername,
      passwordHash,
    },
    cloudinary: {
      cloudName: cloudinaryCloudName,
      apiKey: cloudinaryApiKey,
      apiSecret: cloudinaryApiSecret,
      folder: cloudinaryFolder,
      isConfigured: Boolean(cloudinaryApiKey && cloudinaryApiSecret),
    },
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTest: env === 'test',
  };
}

export const config = validateEnvironment();
