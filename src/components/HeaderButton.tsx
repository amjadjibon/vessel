import React from 'react';

interface HeaderButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false, 
  title
}) => {
  return (
    <button 
      onClick={onClick}
      className="header-action-button"
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

export default HeaderButton;