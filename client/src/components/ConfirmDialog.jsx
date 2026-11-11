import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  const Icon = tone === 'info' ? Info : tone === 'warning' ? AlertTriangle : ShieldAlert;
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : tone === 'warning' ? 'btn-primary' : 'btn-dark'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="spinner" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className={`confirm-icon ${tone}`}>
        <Icon size={21} />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</div>
    </Modal>
  );
}
