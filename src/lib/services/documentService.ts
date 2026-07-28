'use client';

import { createClient } from '@/lib/supabase/client';

export interface UploadedDocument {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  bucketName: string;
  publicUrl: string | null;
  createdAt: string;
  amount: number | null;
  docStatus: 'verwerkt' | 'nog_te_verwerken';
}

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const errorClass = error.code.substring(0, 2);
    if (errorClass === '42') return true;
    if (errorClass === '23') return false;
    if (errorClass === '08') return true;
  }
  if (error.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return schemaErrorPatterns.some((p) => p.test(error.message));
  }
  return false;
}

export const documentService = {
  async uploadDocument(file: File, userId: string): Promise<UploadedDocument | null> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        if (isSchemaError(uploadError)) {
          console.error('Storage schema error:', uploadError.message);
          throw uploadError;
        }
        console.error('Upload error:', uploadError.message);
        throw new Error(uploadError.message);
      }

      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);

      // Always insert with doc_status = 'nog_te_verwerken' — never auto-set to verwerkt
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          bucket_name: 'documents',
          doc_status: 'nog_te_verwerken',
        })
        .select()
        .single();

      if (dbError) {
        if (isSchemaError(dbError)) {
          console.error('DB schema error:', dbError.message);
          throw dbError;
        }
        console.error('DB insert error:', dbError.message);
        return null;
      }

      return {
        id: docData.id,
        userId: docData.user_id,
        fileName: docData.file_name,
        filePath: docData.file_path,
        fileSize: docData.file_size,
        mimeType: docData.mime_type,
        bucketName: docData.bucket_name,
        publicUrl: signedData?.signedUrl ?? null,
        createdAt: docData.created_at,
        amount: docData.amount ?? null,
        // Always return 'nog_te_verwerken' for newly uploaded docs
        docStatus: 'nog_te_verwerken',
        bron: 'upload' as const,
      };
    } catch (error: any) {
      console.error('documentService.uploadDocument error:', error.message);
      throw error;
    }
  },

  async getUserDocuments(userId: string): Promise<UploadedDocument[]> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Schema error:', error.message);
          throw error;
        }
        console.error('Fetch documents error:', error.message);
        return [];
      }

      // Fetch signed URLs for all documents (images get thumbnails, PDFs get viewer URLs)
      const docs = await Promise.all(
        (data || []).map(async (row) => {
          let publicUrl: string | null = null;
          const isImage = row.mime_type && row.mime_type.startsWith('image/');
          const isPdf = row.mime_type === 'application/pdf';
          if ((isImage || isPdf) && row.file_path) {
            const { data: signedData } = await supabase.storage
              .from('documents')
              .createSignedUrl(row.file_path, 3600);
            publicUrl = signedData?.signedUrl ?? null;
          }
          return {
            id: row.id,
            userId: row.user_id,
            fileName: row.file_name,
            filePath: row.file_path,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            bucketName: row.bucket_name,
            publicUrl,
            createdAt: row.created_at,
            amount: row.amount ?? null,
            docStatus: (row.doc_status ?? 'nog_te_verwerken') as 'verwerkt' | 'nog_te_verwerken',
            bron: (row.bron ?? 'upload') as 'upload' | 'email' | 'bankexport',
          };
        })
      );

      return docs;
    } catch (error: any) {
      console.error('documentService.getUserDocuments error:', error.message);
      return [];
    }
  },

  async getDocumentById(docId: string): Promise<UploadedDocument | null> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('getDocumentById error:', error.message);
      return null;
    }

    let publicUrl: string | null = null;
    const isImage = data.mime_type && data.mime_type.startsWith('image/');
    const isPdf = data.mime_type === 'application/pdf';
    if ((isImage || isPdf) && data.file_path) {
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(data.file_path, 3600);
      publicUrl = signedData?.signedUrl ?? null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      fileName: data.file_name,
      filePath: data.file_path,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      bucketName: data.bucket_name,
      publicUrl,
      createdAt: data.created_at,
      amount: data.amount ?? null,
      docStatus: (data.doc_status ?? 'nog_te_verwerken') as 'verwerkt' | 'nog_te_verwerken',
    };
  },

  async deleteDocument(docId: string, filePath: string): Promise<void> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    // Remove file from Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError.message);
      // Continue to delete DB row even if storage fails (file may already be gone)
    }

    // Delete related boekingen rows first (FK constraint: boekingen.brondocument_id → documents.id)
    const { error: boekingenError } = await supabase
      .from('boekingen')
      .delete()
      .eq('brondocument_id', docId);

    if (boekingenError) {
      console.error('Boekingen delete error:', boekingenError.message);
      // Non-fatal: table may not exist or no rows — continue to delete document
    }

    // Remove row from documents table
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('DB delete error:', dbError.message);
      throw new Error(dbError.message);
    }
  },
};
