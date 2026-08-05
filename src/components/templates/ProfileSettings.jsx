import React, { useState, useRef } from 'react';
import { strings } from '../../config/strings';
import { authService } from '../../services/auth';

const ASCII_CHARS = [' ', '.', ',', ':', ';', '+', '*', '?', '%', 'S', '#', '@'];

export default function ProfileSettings({ onBack }) {
  const [resolution, setResolution] = useState(80);
  const [finalImage, setFinalImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const mathCanvasRef = useRef(null);
  const renderCanvasRef = useRef(null);
  const currentImgRef = useRef(null);

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        currentImgRef.current = img;
        generateAsciiImage(img, resolution);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleResolutionChange = (e) => {
    let val = parseInt(e.target.value) || 80;
    if (val > 200) val = 200;
    if (val < 10) val = 10;
    setResolution(val);
    if (currentImgRef.current) {
      generateAsciiImage(currentImgRef.current, val);
    }
  };

  const generateAsciiImage = (img, resString) => {
    // сжимаем оригинальную картинку, чтобы получить сетку пикселей
    const res = parseInt(resString) || 80;
    const mathCanvas = mathCanvasRef.current;
    const mathCtx = mathCanvas.getContext('2d', { willReadFrequently: true });
    const renderCanvas = renderCanvasRef.current;
    const renderCtx = renderCanvas.getContext('2d');

    const aspectRatio = img.height / img.width;
    const cols = res;
    const rows = Math.floor(cols * aspectRatio * 0.5); // 0.5 из-за вытянутости шрифтов

    mathCanvas.width = cols;
    mathCanvas.height = rows;
    mathCtx.drawImage(img, 0, 0, cols, rows);

    const imageData = mathCtx.getImageData(0, 0, cols, rows);
    const pixels = imageData.data;

    // создаем новый большой холст и рисуем на нем текст
    const charWidth = 10;
    const charHeight = 20;
    
    renderCanvas.width = cols * charWidth;
    renderCanvas.height = rows * charHeight;

    // заливаем фон черным
    renderCtx.fillStyle = '#0c0c0c';
    renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

    // настраиваем зеленый моноширинный шрифт
    renderCtx.fillStyle = '#00ff00';
    renderCtx.font = `bold ${charHeight}px "Fira Code", monospace`;
    renderCtx.textAlign = 'left';
    renderCtx.textBaseline = 'top';

    // проходимся по пикселям сжатой картинки и рисуем символы на большом холсте
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offset = (y * cols + x) * 4;
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        const a = pixels[offset + 3];

        if (a < 128) continue; // пропускаем прозрачные пиксели

        // немного выкручиваем яркость (контраст), чтобы картинка не была тусклой
        let brightness = (0.299 * r + 0.587 * g + 0.114 * b) * 1.2;
        if (brightness > 255) brightness = 255;

        const charIndex = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
        const char = ASCII_CHARS[charIndex];
        
        if (char !== ' ') {
          renderCtx.fillText(char, x * charWidth, y * charHeight);
        }
      }
    }

    // превращаем нарисованный холст в строку base64
    const finalBase64 = renderCanvas.toDataURL('image/png');
    // вставляем строку прямо в локальный стейт реакта для тега имг
    setFinalImage(finalBase64);
  };

  const handleSave = () => {
    if (finalImage) {
      authService.updateAvatar(finalImage);
      console.log('[system] avatar updated in localstorage');
      onBack();
    }
  };

  return (
    <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ color: '#00ff00', marginBottom: '20px', textAlign: 'center' }}>
        {strings.profile.title}
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ marginRight: '10px', color: '#00aa00' }}>{strings.profile.uploadLabel}</label>
          <label style={{ cursor: 'pointer', border: '1px solid #00ff00', padding: '2px 8px', color: '#00ff00', background: 'transparent' }}>
            [ BROWSE... ]
            <input 
              id="avatar-upload-input"
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ marginRight: '10px', color: '#00aa00' }}>{strings.profile.resolutionLabel}</label>
          <input 
            type="number" 
            min="10"
            max="200"
            value={resolution}
            onChange={handleResolutionChange}
            style={{ width: '80px', background: 'transparent', color: '#00ff00', border: '1px solid #00ff00', padding: '2px 5px', textAlign: 'center' }}
          />
          <span style={{ marginLeft: '10px', color: '#005500', fontSize: '12px' }}>(max 200)</span>
        </div>
      </div>

      <canvas ref={mathCanvasRef} style={{ display: 'none' }}></canvas>
      <canvas ref={renderCanvasRef} style={{ display: 'none' }}></canvas>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('avatar-upload-input').click()}
        style={{ 
          flex: 1, 
          minHeight: '300px', 
          border: isDragging ? '2px dashed #ffb000' : '1px dashed #005500', 
          backgroundColor: isDragging ? 'rgba(0, 255, 0, 0.05)' : 'transparent',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          overflow: 'hidden', 
          padding: '10px',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
      >
        {finalImage ? (
          <img src={finalImage} alt="avatar preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ color: isDragging ? '#ffb000' : '#005500', pointerEvents: 'none' }}>
            [ drop image here or click ]
          </span>
        )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button type="button" onClick={handleSave} disabled={!finalImage}>
          {strings.profile.saveButton}
        </button>
        <button type="button" onClick={onBack}>
          {strings.profile.backButton}
        </button>
      </div>
    </div>
  );
}
