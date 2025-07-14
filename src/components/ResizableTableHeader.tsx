import React from 'react';
import { ResizableColumnConfig } from '../hooks/useColumnResize';

interface ResizableTableHeaderProps {
  columns: ResizableColumnConfig[];
  onMouseDown: (columnId: string, event: React.MouseEvent) => void;
  getColumnStyle: (columnId: string) => React.CSSProperties;
  isResizing: boolean;
  staticColumns: React.ReactNode;
  children: React.ReactNode;
}

const ResizableTableHeader: React.FC<ResizableTableHeaderProps> = ({
  columns,
  onMouseDown,
  getColumnStyle,
  isResizing,
  staticColumns,
  children
}) => {
  return (
    <thead>
      <tr>
        {staticColumns}
        {columns.filter(col => col.visible).map(column => (
          <th 
            key={column.id} 
            className={column.className || `${column.id}-col`}
            style={getColumnStyle(column.id)}
          >
            <div className="resizable-header-content">
              <span>{column.label}</span>
              <div
                className="resize-handle"
                onMouseDown={(e) => onMouseDown(column.id, e)}
                style={{ cursor: isResizing ? 'col-resize' : 'col-resize' }}
              />
            </div>
          </th>
        ))}
        {children}
      </tr>
    </thead>
  );
};

export default ResizableTableHeader;