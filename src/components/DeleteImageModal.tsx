import React from 'react';
import { X } from 'lucide-react';

interface DeleteImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  imageName: string;
  isLoading?: boolean;
}

const DeleteImageModal: React.FC<DeleteImageModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  imageName, 
  isLoading = false 
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="modal-content delete-modal">
        <div className="modal-header">
          <h2 className="modal-title">Delete image?</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <p className="delete-message">
            The '{imageName}' image is selected for deletion.
          </p>
        </div>
        
        <div className="modal-footer">
          <button
            className="button secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="button danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteImageModal; 