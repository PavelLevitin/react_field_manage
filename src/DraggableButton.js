import React from 'react';
import { useDrag } from 'react-dnd';

function DraggableButton({ name }) {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'button',
    item: { name },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <button
      ref={dragRef}
      className="draggable-button"
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
      }}
    >
      {name}
    </button>
  );
}

export default DraggableButton;
