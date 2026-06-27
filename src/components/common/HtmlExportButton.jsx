import React from 'react';
import Button from './Button';

const HtmlExportButton = ({
  onClick,
  label = '📱 HTML (paysage)',
  disabled = false,
}) => (
  <Button
    className="button-pdf button-html-export"
    onClick={onClick}
    disabled={disabled}
    style={{
      backgroundColor: disabled ? '#94a3b8' : '#0f766e',
      color: '#fff',
      borderColor: disabled ? '#94a3b8' : '#0f766e',
    }}
    title="Export HTML pour mobile — tournez le téléphone en mode paysage pour lire"
  >
    {label}
  </Button>
);

export default HtmlExportButton;
