import { useRef, useState } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { validateImageFile, validateImageDataUrl, LIMITS } from '../utils/validation';
import { compressImage } from '../utils/imageCompression';

export default function ImageUpload({ value, onChange, label = 'Upload Image', size = 80 }) {
  const { darkMode } = useTournament();
  const { showToast } = useDispatch();
  const inputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const error = validateImageFile(file);
    if (error) {
      showToast(error, 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      // Validate the data URL
      if (!validateImageDataUrl(dataUrl)) {
        showToast('Invalid image file. Please try a different image.', 'error');
        return;
      }
      // Always compress to keep logos small for Firestore storage
      try {
        setCompressing(true);
        const compressed = await compressImage(dataUrl, 200, 200, 0.8);
        onChange(compressed);
      } catch {
        // Fallback: use original if compression fails
        onChange(dataUrl);
      } finally {
        setCompressing(false);
      }
    };
    reader.onerror = () => {
      showToast('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className={`rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden group ${
          darkMode
            ? 'border-white/[0.08] bg-white/[0.03] hover:border-accent/50 hover:bg-white/[0.06]'
            : 'border-gray-300/80 bg-gray-50 hover:border-accent hover:bg-gray-100'
        }`}
        style={{ width: size, height: size }}
        onClick={() => !compressing && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => { if (!compressing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
      >
        {compressing ? (
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Processing...</span>
        ) : value ? (
          <img src={value} alt="Preview" className="w-full h-full object-contain p-1" />
        ) : (
          <span className={`text-2xl transition-transform duration-200 group-hover:scale-110 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>+</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFile}
        className="hidden"
        aria-label={`Upload ${label}`}
      />
      <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      {value && !compressing && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
          aria-label={`Remove ${label}`}
        >
          Remove
        </button>
      )}
    </div>
  );
}
