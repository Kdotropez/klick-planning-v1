import React from 'react';
import Button from './Button';

const HtmlExportButton = ({
  onClick,
  label = '📱 Exporter HTML',
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
    title="Télécharge un fichier .html (aperçu paysage mobile) — comme Exporter PDF"
  >
    {label}
  </Button>
);

export default HtmlExportButton;
