import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import './App.css';

const DropContainer = ({ timeSlot }) => {
  const [buttons, setButtons] = useState([]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BUTTON',
    drop: (item) => addButton(item.label),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const addButton = (label) => {
    if (buttons.length >= 4 || buttons.includes(label)) return; // Limit buttons and prevent duplicates
    setButtons((prev) => [...prev, label]);
  };

  const removeButton = (label) => {
    setButtons((prev) => prev.filter((btn) => btn !== label));
  };

  return (
    <div ref={drop} className="drop-container" style={{ backgroundColor: isOver ? '#e0ffe0' : 'lightgreen' }}>
      {buttons.map((label, index) => (
        <div
          key={index}
          className="dropped-button"
          onDoubleClick={() => removeButton(label)}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

export default DropContainer;
