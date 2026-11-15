import { useState } from 'react';
import ImagePicker from './ImagePicker.jsx';
import { toFormData } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

// Form edit teks + gambar, dipakai untuk postingan dan komentar.
// limit (opsional): batas karakter; tombol Simpan nonaktif jika terlampaui.
// onSave(formData) harus melempar error jika gagal.
export default function EditBox({ initialText, currentImage, textField, multiline = true, limit, onSave, onCancel }) {
  const { notify } = useToast();
  const [text, setText] = useState(initialText || '');
  const [img, setImg] = useState({ file: null, url: '' });
  const [removeImg, setRemoveImg] = useState(false);
  const [saving, setSaving] = useState(false);

  const length = text.trim().length;
  const tooLong = limit ? length > limit : false;

  const submit = async (e) => {
    e.preventDefault();
    if (tooLong) return notify(`Teks maksimal ${limit} karakter.`, 'warning');
    const willHaveImage = img.file || img.url.trim() || (currentImage && !removeImg);
    if (!text.trim() && !willHaveImage) return notify('Isi teks atau lampirkan gambar.', 'warning');
    setSaving(true);
    try {
      await onSave(
        toFormData({
          [textField]: text,
          image: img.file,
          image_url: img.url,
          remove_image: removeImg ? 'true' : '',
        })
      );
    } catch (err) {
      notify(err.message, 'error');
      setSaving(false);
    }
  };

  const Field = multiline ? 'textarea' : 'input';
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        className={`input ${multiline ? 'min-h-[88px] resize-y' : ''} ${tooLong ? 'input-error' : ''}`}
        value={text}
        maxLength={limit ? undefined : multiline ? 5000 : 1000}
        onChange={(e) => setText(e.target.value)}
        aria-label="Edit teks"
        aria-invalid={tooLong}
        autoFocus
      />
      {limit && (
        <p
          className={`text-xs font-semibold ${tooLong ? 'text-heart' : length > limit * 0.9 ? 'text-amber-600' : 'text-ink-soft'}`}
          aria-live="polite"
        >
          {length}/{limit}
          {tooLong && ` · kurangi ${length - limit} karakter`}
        </p>
      )}
      {currentImage && !img.file && !img.url && (
        <div className="space-y-2">
          {!removeImg && <img src={currentImage} alt="Gambar saat ini" className="max-h-40 rounded-xl border border-line" />}
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={removeImg} onChange={(e) => setRemoveImg(e.target.checked)} /> Hapus gambar ini
          </label>
        </div>
      )}
      <ImagePicker value={img} onChange={(v) => { setImg(v); setRemoveImg(false); }} onError={(m) => notify(m, 'error')} label={currentImage ? 'Gambar baru' : 'Gambar'} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel} disabled={saving}>Batal</button>
        <button className="btn-primary" disabled={saving || tooLong}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
}