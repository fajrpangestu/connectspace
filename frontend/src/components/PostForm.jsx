import { useState } from 'react';
import { api, toFormData } from '../api.js';
import { detectLocation, locationMessage } from '../geo.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';
import ImagePicker from './ImagePicker.jsx';
import { PinIcon } from './Icons.jsx';

const MAX_CHARS = 500;
const PREF_KEY = 'connectspace.shareLocation';

const readPref = () => {
  try { return localStorage.getItem(PREF_KEY) !== 'false'; } catch { return true; }
};

export default function PostForm({ onCreated }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [content, setContent] = useState('');
  const [img, setImg] = useState({ file: null, url: '' });
  const [shareLocation, setShareLocation] = useState(readPref); // default aktif
  const [phase, setPhase] = useState('idle'); // idle | locating | sending

  const length = content.trim().length;
  const tooLong = length > MAX_CHARS;
  const busy = phase !== 'idle';

  const toggleLocation = (checked) => {
    setShareLocation(checked);
    try { localStorage.setItem(PREF_KEY, String(checked)); } catch { /* abaikan */ }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (tooLong) return notify(`Teks maksimal ${MAX_CHARS} karakter.`, 'warning');
    if (!content.trim() && !img.file && !img.url.trim()) {
      return notify('Status tidak boleh kosong: isi teks atau lampirkan gambar.', 'warning');
    }

    try {
      // 1) Lokasi otomatis (kegagalan tidak menghalangi postingan)
      let location = '';
      if (shareLocation) {
        setPhase('locating');
        const res = await detectLocation();
        location = res.location;
        if (!location) {
          notify(`${locationMessage(res.reason)} Status diterbitkan tanpa lokasi.`, 'warning');
        }
      }

      // 2) Terbitkan
      setPhase('sending');
      const { post } = await api.createPost(
        toFormData({ content, location, image: img.file, image_url: img.url })
      );
      onCreated(post);
      setContent('');
      setImg({ file: null, url: '' });
      notify('Status diterbitkan.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setPhase('idle');
    }
  };

  const label = phase === 'locating' ? 'Mencari lokasi…' : phase === 'sending' ? 'Menerbitkan…' : 'Terbitkan';

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="flex gap-3">
        <Avatar user={user} size={44} />
        <div className="flex-1 space-y-1.5">
          <textarea
            className={`input min-h-[88px] resize-y ${tooLong ? 'input-error' : ''}`}
            placeholder={`Apa kabar, ${user.name.split(' ')[0]}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label="Isi status"
            aria-invalid={tooLong}
          />
          {tooLong && (
            <p className="text-xs font-medium text-heart" role="alert">
              Teks terlalu panjang, kurangi {length - MAX_CHARS} karakter.
            </p>
          )}
        </div>
      </div>

      <div className="pl-[56px]">
        <ImagePicker value={img} onChange={setImg} onError={(m) => notify(m, 'error')} label="Gambar" />
      </div>

      <div className="pl-[56px]">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-brand"
            checked={shareLocation}
            onChange={(e) => toggleLocation(e.target.checked)}
          />
          <PinIcon /> Sertakan lokasi saya (otomatis)
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p
          className={`pl-[56px] text-xs font-semibold ${tooLong ? 'text-heart' : length > MAX_CHARS * 0.9 ? 'text-amber-600' : 'text-ink-soft'
            }`}
          aria-live="polite"
        >
          {length}/{MAX_CHARS}
        </p>
        <button className="btn-primary" disabled={busy || tooLong} title={tooLong ? `Maksimal ${MAX_CHARS} karakter` : undefined}>
          {label}
        </button>
      </div>
    </form>
  );
}