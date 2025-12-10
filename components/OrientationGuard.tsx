import React from 'react';

const OrientationGuard: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 text-white flex flex-col items-center justify-center p-8 text-center landscape:hidden">
      <div className="text-6xl mb-4">📱 ↻</div>
      <h2 className="text-2xl font-bold mb-4 text-yellow-400">가로 모드로 돌려주세요!</h2>
      <p className="text-lg">
        산타의 선물을 확인하려면<br />
        화면을 넓게 봐야 해요.
      </p>
    </div>
  );
};

export default OrientationGuard;