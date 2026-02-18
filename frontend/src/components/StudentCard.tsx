import React, { useState } from 'react';
import { Monitor, Globe, Camera, Sun, Volume2, Bell, Lock, Calculator, Shield, ShieldOff } from 'lucide-react';

interface Student {
  socketId: string;
  deviceId: string;
  currentUrl?: string;
  title?: string;
  tabsCount?: number;
  lastScreenshot?: string;
}

interface StudentCardProps {
  student: Student;
  onCommand: (type: string, payload?: any) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onCommand }) => {
  const [brightness, setBrightness] = useState(50);
  const [volume, setVolume] = useState(50);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [appPackage, setAppPackage] = useState('');
  const [appStoreEnabled, setAppStoreEnabled] = useState(true);

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const level = parseInt(e.target.value);
    setBrightness(level);
    onCommand('SET_BRIGHTNESS', { level: level / 100 });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const level = parseInt(e.target.value);
    setVolume(level);
    onCommand('VOLUME', { level: level / 100 });
  };

  const toggleAppStore = () => {
    const newState = !appStoreEnabled;
    setAppStoreEnabled(newState);
    onCommand('APP_STORE_CONTROL', { enabled: newState });
  };

  const handleLaunchApp = () => {
    if (appPackage) {
      onCommand('LAUNCH_APP', { packageName: appPackage });
      setAppPackage('');
      setShowAppLauncher(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all group">
      <div className="relative bg-gray-50 aspect-video group-hover:bg-gray-100 transition-colors">
        {student.lastScreenshot ? (
          <img
            src={student.lastScreenshot.startsWith('data:') ? student.lastScreenshot : `data:image/jpeg;base64,${student.lastScreenshot}`}
            alt="Screenshot"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
            <Monitor size={48} strokeWidth={1} />
            <span className="text-xs font-medium mt-2">Sem imagem</span>
          </div>
        )}
        <div className="absolute top-3 right-3 flex gap-2">
          <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/20">
            {student.tabsCount || 0} tabs
          </div>
          <button
            onClick={() => onCommand('LOCK_SCREEN')}
            className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full transition-all shadow-lg active:scale-95"
            title="Bloquear Tela Agora"
          >
            <Lock size={14} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">{student.deviceId}</h3>
            {student.currentUrl && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400 font-medium">
                <Globe size={12} />
                <span className="truncate">{student.currentUrl}</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleAppStore}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-tighter transition-all ${appStoreEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            title={appStoreEnabled ? "Apps Store Liberada" : "Apps Store Bloqueada"}
          >
            {appStoreEnabled ? <Shield size={10} /> : <ShieldOff size={10} />}
            {appStoreEnabled ? "Store OK" : "Store OFF"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Sun size={12} />
                  <span>Brilho</span>
                </div>
                <span>{brightness}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={handleBrightnessChange}
                className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Volume2 size={12} />
                  <span>Volume</span>
                </div>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => onCommand('GET_PRINT')}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-2xl transition-all border border-transparent hover:border-indigo-100"
                title="Capturar Tela"
              >
                <Camera size={16} />
                <span className="text-[10px] font-bold uppercase">Print</span>
              </button>
              <button
                onClick={() => onCommand('LAUNCH_CAMERA')}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-2xl transition-all border border-transparent hover:border-blue-100"
                title="Abrir Câmera"
              >
                <Camera size={16} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase">Cam</span>
              </button>
              <button
                onClick={() => onCommand('LAUNCH_CALCULATOR')}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-600 rounded-2xl transition-all border border-transparent hover:border-orange-100"
                title="Abrir Calculadora"
              >
                <Calculator size={16} className="text-orange-500" />
                <span className="text-[10px] font-bold uppercase">Calc</span>
              </button>
              <button
                onClick={() => setShowAppLauncher(!showAppLauncher)}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl transition-all border ${showAppLauncher ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-600 border-transparent hover:border-green-100'}`}
                title="Abrir App"
              >
                <Monitor size={16} />
                <span className="text-[10px] font-bold uppercase">Apps</span>
              </button>
            </div>

            {showAppLauncher && (
              <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                <input
                  type="text"
                  placeholder="Pacote (ex: com.android.chrome)"
                  value={appPackage}
                  onChange={(e) => setAppPackage(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleLaunchApp}
                  disabled={!appPackage}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase disabled:opacity-50"
                >
                  Abrir
                </button>
              </div>
            )}

            <button
              onClick={() => onCommand('ALERT', { message: 'Preste atenção na aula!' })}
              className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl text-[10px] font-bold uppercase shadow-lg shadow-yellow-200 transition-all active:scale-95"
            >
              <Bell size={14} /> Enviar Aviso Rápido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
