import { useState, useCallback, useRef } from 'react';

export interface ResizableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  className?: string;
  width: number;
  minWidth: number;
  maxWidth: number;
}

export function useColumnResize(initialColumns: ResizableColumnConfig[]) {
  const [columns, setColumns] = useState<ResizableColumnConfig[]>(initialColumns);
  const [isResizing, setIsResizing] = useState(false);
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = useCallback((columnId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
    resizingColumn.current = columnId;
    startX.current = event.clientX;
    
    const column = columns.find(col => col.id === columnId);
    startWidth.current = column?.width || 150;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColumn.current) return;
      
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(
        Math.min(startWidth.current + diff, 
          columns.find(col => col.id === resizingColumn.current)?.maxWidth || 400),
        columns.find(col => col.id === resizingColumn.current)?.minWidth || 80
      );

      setColumns(prevColumns =>
        prevColumns.map(col =>
          col.id === resizingColumn.current ? { ...col, width: newWidth } : col
        )
      );
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizingColumn.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columns]);

  const toggleColumnVisibility = useCallback((columnId: string) => {
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  const getColumnStyle = useCallback((columnId: string): React.CSSProperties => {
    const column = columns.find(col => col.id === columnId);
    return {
      width: `${column?.width || 150}px`,
      minWidth: `${column?.minWidth || 80}px`,
      maxWidth: `${column?.maxWidth || 400}px`,
    };
  }, [columns]);

  return {
    columns,
    setColumns,
    isResizing,
    handleMouseDown,
    toggleColumnVisibility,
    getColumnStyle,
  };
}