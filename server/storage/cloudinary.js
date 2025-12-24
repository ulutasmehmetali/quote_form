export class CloudinaryStorageService {
  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!this.cloudName) {
      throw new Error('CLOUDINARY_CLOUD_NAME is not set');
    }

    if (!this.uploadPreset) {
      throw new Error('CLOUDINARY_UPLOAD_PRESET is not set');
    }

    console.log(`Cloudinary configured: cloud_name=${this.cloudName}, upload_preset=${this.uploadPreset}`);
  }

  async uploadFile(buffer, filename, mimetype) {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimetype }), filename);
    formData.append('upload_preset', this.uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `Cloudinary upload failed (${res.status})`);
    }

    const data = await res.json();

    return {
      url: data.secure_url || data.url,
      key: data.public_id,
      provider: 'cloudinary',
    };
  }
}
