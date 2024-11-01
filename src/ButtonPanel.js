import React from 'react';
import { useDrag } from 'react-dnd';
import './App.css';

const buttons = [
  { id: 'button-1', name: 'ילדים א' },
  { id: 'button-2', name: 'נערים א' },
  { id: 'button-3', name: 'נערים ב' },
  { id: 'button-4', name: 'ילדים ג' },
  { id: 'button-5', name: 'שמנים ד' },
];

const DraggableButton = ({ button }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'button',
    item: button,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  return (
    <button
      ref={drag}
      className={`draggable-button ${isDragging ? 'dragging' : ''}`}
    >
      {button.name}
    </button>
  );
};

const ButtonPanel = () => {
  return (
    <div className="button-panel">
      {buttons.map((button) => (
        <DraggableButton key={button.id} button={button} />
      ))}
    </div>
  );
};

export default ButtonPanel;
