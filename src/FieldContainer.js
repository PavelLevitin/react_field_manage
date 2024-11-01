import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import './App.css';

const FieldContainer = ({ id }) => {
  const [buttons, setButtons] = useState([]);

  const [{ isOver }, drop] = useDrop({
    accept: 'button',
    drop: (item) => handleDrop(item),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  const handleDrop = (item) => {
    if (buttons.length >= 4 || buttons.find((btn) => btn.id === item.id)) return;
    setButtons((prev) => [...prev, item]);
  };

  const handleRemove = (id) => {
    setButtons((prev) => prev.filter((btn) => btn.id !== id));
  };

  return (
    <div
      ref={drop}
      className={`field-container ${isOver ? 'hover' : ''}`}
    >
      {buttons.map((button) => (
        <div
          key={button.id}
          className="dropped-button"
          onDoubleClick={() => handleRemove(button.id)}
        >
          {button.name}
        </div>
      ))}
    </div>
  );
};

export default FieldContainer;
