import { useMemo } from "react";

// Стили для золотого свечения
const goldenGlowStyle = `
  :root {
  --color-01: #ffd700;
  --color-02: #ffaa00;
  --color-03: #ffdd44;
  --color-04: #fff566;
  }

  
  @keyframes rainbowBorder {
    0% {
      border-color: var(--color-01);
      box-shadow: 
        0 0 5px var(--color-01),
        0 0 10px var(--color-01),
        0 0 20px var(--color-01);
    }
    25% {
      border-color: var(--color-02);
      box-shadow: 
        0 0 5px var(--color-02),
        0 0 10px var(--color-02),
        0 0 20px var(--color-02);
    }
    50% {
      border-color: var(--color-03);
      box-shadow: 
        0 0 5px var(--color-03),
        0 0 10px var(--color-03),
        0 0 20px var(--color-03);
    }
    75% {
      border-color: var(--color-04);
      box-shadow: 
        0 0 5px var(--color-04),
        0 0 10px var(--color-04),
        0 0 20px var(--color-04);
    }
    100% {
      border-color: var(--color-01);
      box-shadow: 
        0 0 10px var(--color-01),
        0 0 20px var(--color-01),
        0 0 30px var(--color-01);
    }
  }
  
  .golden-glow-wrapper {
    position: relative;
  }

  .golden-glow-avatar {
    position: relative;
    z-index: 2;
    border: 2px solid var(--color-01);
    animation: rainbowBorder 10s ease-in-out infinite;
  }
  
  .golden-sparkles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  
  .golden-sparkle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--color-01);
    border-radius: 50%;
    animation: sparkleFloat 3s infinite ease-in-out;
  }
  
  @keyframes sparkleFloat {
    0%, 100% {
      opacity: 0;
      transform: translateY(0) scale(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-10px) scale(1);
    }
  }
`;

// Компонент для золотого свечения
export const GlowWrapper: React.FC<{
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  sparklesOn?: boolean;
}> = ({ children, disabled, className, sparklesOn, ...rest }) => {
  // Создаем случайные искры
  const sparkles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 35 + Math.random() * 15;
      const x = 50 + Math.cos(angle) * distance;
      const y = 50 + Math.sin(angle) * distance;
      const delay = Math.random() * 3;
      const duration = 2 + Math.random() * 2;

      return (
        <div
          key={i}
          className="golden-sparkle"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            boxShadow: `0 0 10px ${
              i % 2 === 0 ? "var(--color-01)" : "var(--color-02)"
            }`,
          }}
        />
      );
    });
  }, []);

  if (disabled) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <>
      <style>{goldenGlowStyle}</style>
      <div
        className={`golden-glow-wrapper golden-glow-avatar ` + className}
        {...rest}
      >
        {children}
        {sparklesOn && <div className="golden-sparkles">{sparkles}</div>}
      </div>
    </>
  );
};

// Альтернативный вариант - более минималистичный
export const GoldenGlowSimple: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const simpleGlowStyle = `
    .simple-golden-glow {
      position: relative;
      border-radius: 50%;
      padding: 6px;
      background: radial-gradient(
        circle at 30% 30%,
        rgba(255, 215, 0, 0.6) 0%,
        rgba(255, 170, 0, 0.4) 30%,
        transparent 70%
      );
      animation: goldenPulse 2s ease-in-out infinite;
    }
    
    .simple-golden-glow::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border-radius: 50%;
      background: linear-gradient(
        45deg,
        var(--color-01),
        var(--color-02),
        var(--color-01),
        var(--color-02),
        var(--color-01)
      );
      background-size: 400% 400%;
      animation: gradientShift 3s ease infinite;
      z-index: -1;
      opacity: 0.8;
    }
    
    .simple-golden-glow::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 50%;
      background: radial-gradient(
        circle at center,
        transparent 40%,
        rgba(255, 215, 0, 0.1) 70%,
        rgba(255, 170, 0, 0.05) 100%
      );
      animation: pulseGlow 4s ease-in-out infinite;
    }
    
    @keyframes gradientShift {
      0%, 100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }
    
    @keyframes pulseGlow {
      0%, 100% {
        transform: scale(1);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.05);
        opacity: 1;
      }
    }
    
    .simple-golden-content {
      position: relative;
      z-index: 1;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 
        inset 0 0 10px rgba(255, 215, 0, 0.3),
        0 0 20px rgba(255, 215, 0, 0.4);
    }
  `;

  return (
    <>
      <style>{simpleGlowStyle}</style>
      <div className="simple-golden-glow">
        <div className="simple-golden-content">{children}</div>
      </div>
    </>
  );
};
