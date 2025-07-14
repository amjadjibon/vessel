import React from 'react';

interface HeaderButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary';
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false, 
  title,
  variant = 'secondary'
}) => {
  return (
    <button 
      onClick={onClick}
      className={`header-action-button ${variant === 'primary' ? 'primary' : ''}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

export default HeaderButton;