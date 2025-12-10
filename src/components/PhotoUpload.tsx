import { useState, useRef, useMemo, useEffect, type ChangeEvent } from 'react';
import Button from './Button';
import ArrowRightIcon from './icons/ArrowRight';
import type { UploadedPhoto } from '../types/quote';
import { apiUrl } from '../lib/api';

interface PhotoUploadProps {
  onSubmit: (uploadedPhotos: UploadedPhoto[]) => void;
  onBack: () => void;
  onNext: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export default function PhotoUpload({ onSubmit, onBack, onNext, currentStep, totalSteps }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => {
    return photos.map(file => URL.createObjectURL(file));
  }, [photos]);

  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    const totalFiles = [...photos, ...newFiles].slice(0, 4); // max 4 files
    
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total
    
    for (const file of totalFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds 20MB. Please choose a smaller file.`);
        return;
      }
    }
    
    const totalSize = totalFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      setError('Total upload size exceeds 20MB. Please remove or compress files.');
      return;
    }
    if (totalFiles.length > 4) {
      setError('You can upload up to 4 files.');
      return;
    }
    
    setError('');
    setPhotos(totalFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      handleSkip();
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      photos.forEach(photo => {
        formData.append('photos', photo);
      });

      const response = await fetch(apiUrl('/api/upload/photos'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.detail || errorData.message || 'Upload failed');
        } else {
          throw new Error(response.status === 413 
            ? 'Upload too large. Please reduce file size or number of photos.'
            : `Upload failed (${response.status})`);
        }
      }

      const data = await response.json();
      const files = Array.isArray(data.files) ? data.files : [];
      const uploadedPhotos: UploadedPhoto[] = files.map((file: any) => ({
        url: file.url,
        key: file.key || file.url,
        provider: file.provider || 'local',
      }));
      
      onSubmit(uploadedPhotos);
      onNext();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload photos. Please try again.');
      setUploading(false);
    }
  };

  const handleSkip = () => {
    onSubmit([]);
    onNext();
  };

  const progressPercentage = currentStep && totalSteps ? Math.round((currentStep / totalSteps) * 100) : 75;
  const stepLabel = currentStep && totalSteps ? `Step ${currentStep} of ${totalSteps}` : 'Step 3 of 4';

  return (
    <section className="animate-slideInRight">
      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">{stepLabel}</span>
              <span className="text-xs font-medium text-slate-600">{progressPercentage}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-300" style={{width: `${progressPercentage}%`}}></div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Upload Photos or Videos (Optional)</h2>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-700">
              Max 4 files · 20MB total
            </div>
            <p className="text-slate-600 text-sm">
              Add photos or short clips (total up to 20MB) to help pros understand your project.
            </p>
            <p className="text-slate-500 text-xs">
              Tip: Keep videos short (under ~2 minutes / 1080p) so they upload quickly.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-sky-400 bg-sky-50'
                : 'border-slate-200 bg-slate-100 hover:border-sky-400 hover:bg-sky-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleChange}
              className="hidden"
            />
            
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center">
                  <svg className="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sky-600 font-semibold hover:text-sky-700 transition-colors"
                >
                  Click to upload
                </button>
                <span className="text-slate-600"> or drag and drop</span>
              </div>
              
              <p className="text-xs text-slate-500">
                Images: PNG, JPG, HEIC · Video: MP4, MOV, WEBM · Up to 4 files, 20MB total
              </p>
            </div>
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {previews.map((preview, index) => {
                const isVideo = photos[index]?.type?.startsWith('video/');
                return (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-200">
                    {isVideo ? (
                      <div className="w-full h-full bg-slate-900/80 text-white flex items-center justify-center text-xs">
                        <svg className="w-6 h-6 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 4h16v16H4z" />
                          <path d="M10 8l6 4-6 4V8z" />
                        </svg>
                        Video selected · keep it short
                      </div>
                    ) : (
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/60 to-transparent p-2">
                      <p className="text-xs text-white truncate">{photos[index]?.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
            <svg className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-emerald-800 leading-snug">
              Photos help professionals provide more accurate quotes. You can always add more later.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">

            <Button

              type="button"

              onClick={onBack}

              variant="secondary"

              size="lg"

              className="flex-1 h-12 text-base"

              disabled={uploading}

            >

              Back

            </Button>

            {photos.length > 0 ? (

              <Button

                type="button"

                onClick={handleSubmit}

                size="lg"

                className="flex-1 h-12 text-base gap-2 justify-center"

                disabled={uploading}

              >

                {uploading ? (

                  <>

                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">

                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>

                    </svg>

                    Uploading...

                  </>

                ) : (

                  <>

                    <span className="flex-1 text-center">

                      Continue with {photos.length} photo{photos.length > 1 ? 's' : ''}

                    </span>

                    <ArrowRightIcon />

                  </>

                )}

              </Button>

            ) : (

              <Button

                type="button"

                onClick={handleSkip}

                variant="secondary"

                size="lg"

                className="flex-1 h-12 text-base gap-2 justify-center"

              >

                <span className="flex-1 text-center">Skip & Continue</span>

                <ArrowRightIcon />

              </Button>

            )}

          </div>

        </div>
      </div>
    </section>
  );
}
