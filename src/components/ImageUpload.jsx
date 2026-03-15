import { useRef } from 'react';
import { useTournament } from '../context/TournamentContext';
import { validateImageFile, validateImageDataUrl, LIMITS } from '../utils/validation';

export default function ImageUpload({ value, onChange, label = 'Upload Image', size = 80 }) {
  const { darkMode } = useTournament();
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const error = validateImageFile(file);
    if (error) {
      // Show a basic alert since we don't have showToast here
      alert(error);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      // Validate the data URL
      if (!validateImageDataUrl(dataUrl)) {
        alert('Invalid image file. Please try a different image.');
        return;
      }
      onChange(dataUrl);
    };
    reader.onerror = () => {
      alert('Failed to read image file');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${
          darkMode
            ? 'border-white/10 bg-white/5 hover:border-accent/50 hover:bg-white/10'
            : 'border-gray-300 bg-gray-50 hover:border-accent hover:bg-gray-100'
        }`}
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      >
        {value ? (
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <span className={`text-2xl ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>+</span>
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
      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      {value && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-red-400 hover:text-red-300"
          aria-label={`Remove ${label}`}
        >
          Remove
        </button>
      )}
    </div>
  );
}
