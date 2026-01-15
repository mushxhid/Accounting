export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Upload image to Cloudinary directly from client-side
 * Uses unsigned upload preset for simplicity
 */
export const uploadImageToCloudinary = async (
  file: File
): Promise<CloudinaryUploadResult> => {
  // Access environment variables - Vite exposes only VITE_* prefixed variables
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Debug: Log available env vars in development (will be removed in production build)
  if (import.meta.env.DEV) {
    console.log('Cloudinary Config Check:', {
      hasCloudName: !!cloudName,
      hasUploadPreset: !!uploadPreset,
      cloudNameLength: cloudName?.length || 0,
      uploadPresetLength: uploadPreset?.length || 0,
    });
  }

  if (!cloudName || cloudName === 'your_cloud_name_here' || cloudName.trim() === '') {
    throw new Error(
      'Cloudinary Cloud Name not configured. ' +
      'Please add VITE_CLOUDINARY_CLOUD_NAME environment variable. ' +
      'For Vercel: Go to Project Settings > Environment Variables and add it for Production, Preview, and Development environments.'
    );
  }

  if (!uploadPreset || uploadPreset.trim() === '') {
    throw new Error(
      'Cloudinary Upload Preset not configured. ' +
      'Please add VITE_CLOUDINARY_UPLOAD_PRESET environment variable. ' +
      'Make sure you have created the preset in Cloudinary Dashboard and added it to Vercel Environment Variables.'
    );
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 10MB');
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'expenses/receipts'); // Organize receipts in folder
  formData.append('timestamp', Date.now().toString());

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      url: data.url,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload image to Cloudinary');
  }
};

/**
 * Get optimized image URL from Cloudinary
 * Useful for thumbnails or resized images
 */
export const getCloudinaryOptimizedUrl = (
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }
): string => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!cloudName || cloudName === 'your_cloud_name_here') {
    throw new Error('Cloudinary Cloud Name not configured');
  }

  const transformations: string[] = [];
  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.quality) transformations.push(`q_${options.quality}`);
  if (options?.format) transformations.push(`f_${options.format}`);

  const transformStr = transformations.length > 0 ? transformations.join(',') + '/' : '';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformStr}${publicId}`;
};
