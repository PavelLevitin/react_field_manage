import React, { useState } from 'react';
import { useDrop } from 'react-dnd';

function DroppableContainer({ id }) {
  const [buttons, setButtons] = useState([]);

  const [{ isOver }, dropRef] = useDrop({
    accept: 'button',
    drop: (item) => handleDrop(item),
    canDrop: (item) => !buttons.includes(item.name) && buttons.length < 4,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const handleDrop = (item) => {
    if (!buttons.includes(item.name) && buttons.length < 4) {
      setButtons((prev) => [...prev, item.name]);
    }
  };

  const handleRemove = (name) => {
    setButtons((prev) => prev.filter((button) => button !== name));
  };

  return (
    <div className={`droppable-container ${isOver ? 'hovered' : ''}`} ref={dropRef}>
      {buttons.map((button) => (
        <div
          key={button}
          className="dropped-button"
          onDoubleClick={() => handleRemove(button)}
        >
          {button}
        </div>
      ))}
    </div>
  );
}

export default DroppableContainer;
