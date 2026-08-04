import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, User as SupabaseUser } from '@supabase/supabase-js';

type SignedImageUpload = {
  signedUrl: string;
  token: string;
};

@Injectable()
export class SupabaseAdminService {
  private readonly client: ReturnType<typeof createClient>;
  private readonly storageBucket: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');

    const secretKey = this.configService.getOrThrow<string>(
      'SUPABASE_SECRET_KEY',
    );

    this.storageBucket = this.configService.getOrThrow<string>(
      'SUPABASE_STORAGE_BUCKET',
    );

    this.client = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async createConfirmedUser(
    email: string,
    password: string,
  ): Promise<SupabaseUser> {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Supabase Auth did not return the created user');
    }

    return data.user;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);

    if (error) {
      throw error;
    }
  }

  async createSignedImageUploadUrl(
    storagePath: string,
  ): Promise<SignedImageUpload> {
    const { data, error } = await this.client.storage
      .from(this.storageBucket)
      .createSignedUploadUrl(storagePath, {
        upsert: false,
      });

    if (error) {
      throw error;
    }

    if (!data?.signedUrl || !data.token) {
      throw new Error(
        'Supabase Storage did not return signed upload information',
      );
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
    };
  }

  getPublicImageUrl(storagePath: string): string {
    const { data } = this.client.storage
      .from(this.storageBucket)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }
}
