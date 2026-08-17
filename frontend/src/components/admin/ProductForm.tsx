'use client';

import { useRef, useState } from 'react';
import {
  ApiError, AdminProduct, PRODUCT_CATEGORIES, ProductCategory,
  api, uploadProductImage,
} from '@/lib/api';
import { GOLD } from '@/components/admin/ui';

const MAX_IMAGE_MB = 8;

interface Props {
  editing: AdminProduct | null;
  uploadsEnabled: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const field: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--admin-line)',
  color: 'var(--admin-ink)',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--admin-muted)' }}>
      {children}
    </span>
  );
}

export default function ProductForm({ editing, uploadsEnabled, onClose, onSaved }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState<ProductCategory>(editing?.category ?? 'necklaces');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [rupees, setRupees] = useState(editing ? String(editing.priceMinor / 100) : '');
  const [image, setImage] = useState(editing?.image ?? '');
  const [publicId, setPublicId] = useState(editing?.imagePublicId ?? '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`That image is larger than ${MAX_IMAGE_MB}MB — please use a smaller one.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const up = await uploadProductImage(file);
      setImage(up.url);
      setPublicId(up.publicId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That image could not be uploaded');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFields({});

    const priceMinor = Math.round(Number(rupees.replace(/[^0-9.]/g, '')) * 100);
    const body = {
      name: name.trim(),
      category,
      description: description.trim(),
      priceMinor: Number.isFinite(priceMinor) ? priceMinor : 0,
      imageUrl: image,
      imagePublicId: publicId,
    };

    try {
      if (editing) {
        await api.patch(`/api/admin/products/${editing.id}`, body);
        onSaved(`${body.name} updated`);
      } else {
        await api.post('/api/admin/products', body);
        onSaved(`${body.name} added to the catalogue`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError('Could not save that piece');
      }
      setSaving(false);
    }
  };

  const err = (key: string) =>
    fields[key] && <span className="block text-xs mt-1" style={{ color: '#d03b3b' }}>{fields[key]}</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(8,17,36,0.45)', backdropFilter: 'blur(2px)' }}
      />

      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl px-7 py-7"
        style={{ background: '#ffffff', boxShadow: '0 24px 60px rgba(11,23,48,0.22)' }}
      >
        <div className="flex gap-2.5 mb-6">
          <span className="mt-1 h-4 w-[2px] rounded-full shrink-0" style={{ background: GOLD }} />
          <div>
            <h2 className="font-cormorant text-2xl font-semibold leading-tight" style={{ color: 'var(--admin-ink)' }}>
              {editing ? 'Edit piece' : 'Add a piece'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-muted)' }}>
              Shown in the shop alongside the try-on pieces, without live try-on.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="block">
            <Label>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aurora Pearl Drops"
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
              style={field}
            />
            {err('name')}
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none capitalize"
                style={field}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <Label>Price (Rs)</Label>
              <input
                value={rupees}
                onChange={(e) => setRupees(e.target.value)}
                inputMode="decimal"
                placeholder="1250"
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
              />
              {err('priceMinor')}
            </label>
          </div>

          <label className="block">
            <Label>Description</Label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hand-set freshwater pearls"
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
              style={field}
            />
            <span className="block text-xs mt-1" style={{ color: 'var(--admin-muted)' }}>
              One short line — it sits under the name on the card.
            </span>
          </label>

          <div>
            <Label>Photo</Label>
            <div className="flex items-center gap-4">
              <div
                className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl"
                style={{ background: '#f6f5f3', border: '1px solid var(--admin-line)' }}
              >
                {image ? (
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-center px-2" style={{ color: 'var(--admin-muted)' }}>
                    No photo
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void pickImage(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={!uploadsEnabled || uploading}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg px-4 py-2 text-sm transition disabled:opacity-40 disabled:cursor-default"
                  style={field}
                >
                  {uploading ? 'Uploading…' : image ? 'Replace photo' : 'Choose photo'}
                </button>
                {image && !uploading && (
                  <button
                    type="button"
                    onClick={() => { setImage(''); setPublicId(''); }}
                    className="ml-3 text-xs underline"
                    style={{ color: 'var(--admin-muted)' }}
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--admin-muted)' }}>
                  {uploadsEnabled
                    ? `Square images look best. Up to ${MAX_IMAGE_MB}MB.`
                    : 'Uploads are not configured on the server yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm mt-5" style={{ color: '#d03b3b' }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm"
            style={{ color: 'var(--admin-muted)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-lg px-5 py-2.5 text-sm transition disabled:opacity-50 disabled:cursor-default"
            style={{ background: 'var(--admin-rail)', color: '#f4efe6' }}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add piece'}
          </button>
        </div>
      </form>
    </div>
  );
}
