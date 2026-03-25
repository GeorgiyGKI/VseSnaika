import React from "react";

const LoadingOverlay = () => {
  return (
    <div className="loading-wrapper">
      <div className="loading-shadow-wrapper auth-shadow">
        <div className="loading-shadow">
          <div className="loading-animation w-10 h-10 border-4 border-[#212a3b] border-t-transparent rounded-full" />
          <div className="loading-title">Обрабатываем книгу…</div>
          <div className="loading-progress">
            <div className="loading-progress-item">
              <span className="loading-progress-status" />
              <span>Подготавливаем данные</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
