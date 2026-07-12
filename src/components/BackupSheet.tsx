import { useEffect, useState } from 'react';
import { buildBackup, recordBackupDone } from '../lib/backup';
import { Sheet } from './ui';
import { useUndo } from '../lib/undo';

/**
 * Two-step backup. Building the zip takes a moment, and Android only
 * opens the share sheet for a FRESH tap — so we prepare the file first,
 * then she taps once more and the share sheet (with Save to Drive)
 * opens instantly. That fresh tap is what makes Drive work.
 */
export function BackupSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useUndo();
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    buildBackup()
      .then(setFile)
      .catch(() => setFailed(true));
  }, []);

  const canShare = !!file && !!navigator.canShare && navigator.canShare({ files: [file] });

  async function shareIt() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'Jillie backup' });
      recordBackupDone();
      onClose();
      toast('Backup on its way — pick Save to Drive.');
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        toast("That didn't work — try Save to phone instead.");
      }
    }
  }

  function download() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    recordBackupDone();
    onClose();
    toast('Backup saved to your phone (in Downloads).');
  }

  return (
    <Sheet onClose={onClose} label="Save a backup">
      <h2>Save a backup</h2>
      {!file && !failed && <p style={{ color: 'var(--ink-soft)', marginBottom: '1rem' }}>Getting your backup ready…</p>}
      {failed && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Something went wrong building the backup — close this and try again.</p>}
      {file && (
        <>
          <p style={{ color: 'var(--ink-soft)', marginBottom: '1rem' }}>
            Ready — everything packed into one file ({(file.size / (1024 * 1024)).toFixed(1)} MB).
          </p>
          {canShare && (
            <button className="btn btn-primary btn-block" onClick={shareIt}>
              Send to Google Drive
            </button>
          )}
          <button
            className={`btn ${canShare ? 'btn-tint' : 'btn-primary'} btn-block`}
            style={{ marginTop: '0.625rem' }}
            onClick={download}
          >
            Save to phone instead
          </button>
          {canShare && (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.75rem', marginTop: '0.625rem', textAlign: 'center' }}>
              A sharing menu will open — pick Drive (Save to Drive), then Save.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
