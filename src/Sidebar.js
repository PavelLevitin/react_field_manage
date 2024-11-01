import React from 'react';
import DraggableButton from './DraggableButton';

const buttons = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד'];

function Sidebar() {
  return (
    <div className="sidebar">
      {buttons.map((name) => (
        <DraggableButton key={name} name={name} />
      ))}
    </div>
  );
}

export default Sidebar;
