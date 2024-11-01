import React from 'react';
import { useDrag } from 'react-dnd';

const SidebarButton = ({ button }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BUTTON',
    item: button,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: 'lightgray',
        border: '1px solid black',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
      }}
    >
      {button.label}
    </div>
  );
};

export default SidebarButton;
