import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config/index.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
}

export interface CloudinaryUploadOptions {
  buffer: Buffer;
  filename: string;
  memberIdentifier: string;
}

export class CloudinaryService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private folder: string;
  private isConfigured: boolean;

  // Mock hooks for deterministic, offline testing
  private mockMode: boolean = false;
  private simulateFailure: 'upload' | 'destroy' | null = null;
  private destroyedPublicIds: string[] = [];

  constructor() {
    this.cloudName = config.cloudinary.cloudName;
    this.apiKey = config.cloudinary.apiKey;
    this.apiSecret = config.cloudinary.apiSecret;
    this.folder = config.cloudinary.folder;
    this.isConfigured = config.cloudinary.isConfigured;

    // Automatically enable mock mode in test environment if credentials are not set
    if (!this.isConfigured && (config.isTest || process.env.NODE_ENV === 'test')) {
      this.mockMode = true;
    }
  }

  /**
   * Set mock mode explicitly for testing
   */
  public setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public isReady(): boolean {
    return this.isConfigured || this.mockMode;
  }

  /**
   * Simulate a Cloudinary network or API failure during testing
   */
  public setSimulateFailure(failure: 'upload' | 'destroy' | null): void {
    this.simulateFailure = failure;
  }

  /**
   * Get list of destroyed public IDs for test assertion
   */
  public getDestroyedPublicIds(): string[] {
    return [...this.destroyedPublicIds];
  }

  /**
   * Clear test tracking state
   */
  public resetTestState(): void {
    this.destroyedPublicIds = [];
    this.simulateFailure = null;
  }

  /**
   * Generate SHA-1 cryptographic signature for Cloudinary API requests
   */
  public generateSignature(params: Record<string, string | number>, apiSecret: string): string {
    const sortedKeys = Object.keys(params)
      .filter((k) => k !== 'file' && k !== 'cloud_name' && k !== 'resource_type' && k !== 'api_key')
      .sort();

    const stringToSign = sortedKeys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
    return crypto.createHash('sha1').update(stringToSign).digest('hex');
  }

  /**
   * Upload member profile image with Web-optimized transformation
   */
  public async uploadProfileImage(options: CloudinaryUploadOptions): Promise<CloudinaryUploadResult> {
    if (this.simulateFailure === 'upload') {
      throw new AppError(502, 'Cloudinary upload service unavailable (simulated)', undefined, 'CLOUDINARY_UPLOAD_FAILED');
    }

    const ext = path.extname(options.filename).toLowerCase();
    const cleanId = options.memberIdentifier
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) || 'member';

    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `${this.folder}/${cleanId}_${Date.now()}`;

    // Mock Mode Execution (for offline/CI test suites)
    if (this.mockMode) {
      const mockFormat = ext.replace(/^\./, '') || 'webp';
      const mockDeliveryUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/v${timestamp}/${publicId}.${mockFormat}`;
      return {
        secureUrl: mockDeliveryUrl,
        publicId,
        format: mockFormat,
        width: 800,
        height: 800,
        bytes: options.buffer.length,
      };
    }

    // Live Cloudinary REST API Execution
    if (!this.isConfigured) {
      throw new AppError(
        503,
        'Cloudinary service is not configured. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
        undefined,
        'CLOUDINARY_NOT_CONFIGURED'
      );
    }

    const transformation = 'c_limit,w_1200,h_1200,q_auto,f_auto';
    const paramsToSign: Record<string, string | number> = {
      folder: this.folder,
      overwrite: 'true',
      public_id: path.basename(publicId),
      timestamp,
      transformation,
    };

    const signature = this.generateSignature(paramsToSign, this.apiSecret);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(options.buffer)]);

    formData.append('file', blob, options.filename);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', this.folder);
    formData.append('public_id', path.basename(publicId));
    formData.append('overwrite', 'true');
    formData.append('transformation', transformation);
    formData.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const responseData = (await response.json()) as any;

      if (!response.ok || !responseData.secure_url) {
        const errorMsg = responseData?.error?.message || `Cloudinary upload failed with HTTP status ${response.status}`;
        console.error('[Cloudinary] Upload failed:', errorMsg);
        throw new AppError(502, `Cloudinary upload failed: ${errorMsg}`, undefined, 'CLOUDINARY_UPLOAD_FAILED');
      }

      return {
        secureUrl: responseData.secure_url,
        publicId: responseData.public_id,
        format: responseData.format,
        width: responseData.width,
        height: responseData.height,
        bytes: responseData.bytes,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('[Cloudinary] Network error during upload:', err.message);
      throw new AppError(502, `Cloudinary network error: ${err.message}`, undefined, 'CLOUDINARY_NETWORK_ERROR');
    }
  }

  /**
   * Upload generic media asset with Web-optimized transformation
   */
  public async uploadMediaAsset(options: {
    buffer: Buffer;
    filename: string;
    category?: string;
    identifier?: string;
    folder?: string;
    transformation?: string;
  }): Promise<CloudinaryUploadResult> {
    if (this.simulateFailure === 'upload') {
      throw new AppError(502, 'Cloudinary upload service unavailable (simulated)', undefined, 'CLOUDINARY_UPLOAD_FAILED');
    }

    const ext = path.extname(options.filename).toLowerCase();
    const cleanId = (options.identifier || path.basename(options.filename, ext))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) || 'asset';

    const category = options.category || 'general';
    const targetFolder = options.folder || `nexus/${category}`;
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `${targetFolder}/${cleanId}_${Date.now()}`;

    // Mock Mode Execution (for offline/CI test suites)
    if (this.mockMode) {
      const mockFormat = ext.replace(/^\./, '') || 'webp';
      const mockDeliveryUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/v${timestamp}/${publicId}.${mockFormat}`;
      return {
        secureUrl: mockDeliveryUrl,
        publicId,
        format: mockFormat,
        width: 1200,
        height: 800,
        bytes: options.buffer.length,
      };
    }

    // Live Cloudinary REST API Execution
    if (!this.isConfigured) {
      throw new AppError(
        503,
        'Cloudinary service is not configured. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
        undefined,
        'CLOUDINARY_NOT_CONFIGURED'
      );
    }

    const transformation = options.transformation || 'c_limit,w_1200,h_1200,q_auto,f_auto';
    const paramsToSign: Record<string, string | number> = {
      folder: targetFolder,
      overwrite: 'true',
      public_id: path.basename(publicId),
      timestamp,
      transformation,
    };

    const signature = this.generateSignature(paramsToSign, this.apiSecret);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(options.buffer)]);

    formData.append('file', blob, options.filename);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', targetFolder);
    formData.append('public_id', path.basename(publicId));
    formData.append('overwrite', 'true');
    formData.append('transformation', transformation);
    formData.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const responseData = (await response.json()) as any;

      if (!response.ok || !responseData.secure_url) {
        const errorMsg = responseData?.error?.message || `Cloudinary upload failed with HTTP status ${response.status}`;
        console.error('[Cloudinary] Upload failed:', errorMsg);
        throw new AppError(502, `Cloudinary upload failed: ${errorMsg}`, undefined, 'CLOUDINARY_UPLOAD_FAILED');
      }

      return {
        secureUrl: responseData.secure_url,
        publicId: responseData.public_id,
        format: responseData.format,
        width: responseData.width,
        height: responseData.height,
        bytes: responseData.bytes,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('[Cloudinary] Network error during upload:', err.message);
      throw new AppError(502, `Cloudinary network error: ${err.message}`, undefined, 'CLOUDINARY_NETWORK_ERROR');
    }
  }

  /**
   * Safely delete an image asset from Cloudinary by public ID
   */
  public async destroyImage(publicId: string): Promise<boolean> {
    if (!publicId || typeof publicId !== 'string') return false;

    if (this.simulateFailure === 'destroy') {
      throw new AppError(502, 'Cloudinary destroy service unavailable (simulated)', undefined, 'CLOUDINARY_DESTROY_FAILED');
    }

    if (this.mockMode) {
      this.destroyedPublicIds.push(publicId);
      return true;
    }

    if (!this.isConfigured) {
      console.warn(`[Cloudinary] Cannot destroy asset "${publicId}": Cloudinary credentials not configured.`);
      return false;
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      public_id: publicId,
      timestamp,
    };

    const signature = this.generateSignature(paramsToSign, this.apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const destroyUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;

    try {
      const response = await fetch(destroyUrl, {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as any;
      if (response.ok && (data.result === 'ok' || data.result === 'not found')) {
        this.destroyedPublicIds.push(publicId);
        return true;
      }

      console.warn(`[Cloudinary] Asset destroy warning for "${publicId}":`, data);
      return false;
    } catch (err: any) {
      console.error(`[Cloudinary] Failed to destroy asset "${publicId}":`, err.message);
      return false;
    }
  }
}

export const cloudinaryService = new CloudinaryService();
