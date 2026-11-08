import { useEffect, useRef } from 'react';

function ConfirmDeleteDialog({ item, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (item && dialog && !dialog.open) dialog.showModal();
    if (!item && dialog?.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    >
      {item && (
        <div className="dialog-content">
          <span className="dialog-warning-icon" aria-hidden="true">!</span>
          <p className="admin-eyebrow">PERMANENT ACTION</p>
          <h2 id="delete-dialog-title">Delete this feedback?</h2>
          <p id="delete-dialog-description" className="dialog-description">
            This will permanently delete the feedback from <strong>{item.name}</strong> ({item.email}).
            This action cannot be undone.
          </p>
          {error && <p className="admin-alert" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="admin-secondary-button" type="button" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
            <button className="danger-button" type="button" disabled={busy} onClick={onConfirm}>
              {busy ? 'Deleting…' : 'Delete feedback'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export default ConfirmDeleteDialog;
