import React from 'react';

const SensorCard = ({ title, value, unit, icon: Icon, color, statusText }) => {
  return (
    <div className="glass-panel sensor-card" style={{ '--card-color': color }}>
      <div className="icon-wrapper">
        <Icon size={36} />
      </div>
      <div className="sensor-title">{title}</div>
      <div className="sensor-value">
        {value} {unit && <span className="sensor-unit">{unit}</span>}
      </div>
      {statusText && (
        <div className="status-badge" style={{ color: color }}>
          {statusText}
        </div>
      )}
    </div>
  );
};

export default SensorCard;
