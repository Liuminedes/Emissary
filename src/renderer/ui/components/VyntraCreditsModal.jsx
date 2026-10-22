import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import emissaryAppIcon from '../../assets/logo.png';

export function VyntraCreditsModal({ isOpen, onClose }) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
          {/* Fondo oscuro espacial con blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
          />

          {/* Partículas de estrellas (simuladas con CSS puro y un grid) */}
          <div className="absolute inset-0 opacity-30 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(1.5px 1.5px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 50px 160px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 130px 80px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 160px 120px, #fff, rgba(0,0,0,0))', backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }} 
          />

          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-5xl mx-auto p-12"
          >
            {/* Botón Cerrar */}
            <button 
              onClick={onClose}
              className="absolute -top-10 right-4 text-white/40 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative">
              
              {/* Separador brillante en medio (solo desktop) */}
              <div className="hidden md:block absolute left-1/2 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent transform -translate-x-1/2" />

              {/* Columna Izquierda: Emissary */}
              <div className="flex flex-col items-center justify-center text-center">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative w-56 h-56 rounded-[2.5rem] overflow-hidden mb-8 shadow-[0_0_50px_rgba(59,130,246,0.3)] ring-1 ring-white/20 group"
                >
                  <img 
                    src={emissaryAppIcon} 
                    alt="Emissary App Icon" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 pointer-events-none" />
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h4 className="text-blue-400 font-medium tracking-[0.2em] uppercase text-xs" style={{ textShadow: '0 0 10px rgba(59,130,246,0.5)' }}>
                      Plataforma
                    </h4>
                  </div>
                  <h2 className="text-white text-5xl font-bold tracking-tight mb-2" style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
                    Emissary
                  </h2>
                  <p className="text-white/50 font-medium tracking-wide">
                    Inteligencia Artificial & Mensajería
                  </p>
                </motion.div>
              </div>

              {/* Columna Derecha: Vyntra Orbit */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                  {/* Anillo de fondo pulsante (Glow Morado) */}
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-transparent border-[6px] border-[#a855f7]"
                    style={{ 
                      boxShadow: '0 0 50px rgba(168, 85, 247, 0.8), inset 0 0 30px rgba(168, 85, 247, 0.5)',
                      filter: 'blur(1px)'
                    }}
                  />
                  
                  {/* Anillo de borde interior oscuro */}
                  <div className="absolute inset-3 rounded-full bg-[#0a0a0a] border border-[#a855f7]/30 shadow-inner" />

                  {/* Logo SVG Animado (Planeta Blanco Neón) */}
                  <motion.div 
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" 
                        style={{ filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.9)) drop-shadow(0px 0px 20px rgba(255,255,255,0.5))' }}>
                      <circle cx="12" cy="12" r="5" fill="#111" strokeWidth="2" />
                      <path d="M5.5 15.5C3.5 14 3.5 12 5.5 10.5C8 8.5 12.5 7.5 17 8.5" opacity="0.4" strokeWidth="1.5" />
                      <path d="M17 8.5C19 9.5 20.5 11 20.5 12.5C20.5 14.5 18 16 15 17C12 18 8 17.5 5.5 15.5" strokeWidth="2" />
                    </svg>
                  </motion.div>
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h4 className="text-[#a855f7] font-medium tracking-[0.3em] uppercase text-xs mb-3" style={{ textShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                    Powered By
                  </h4>
                  <h2 className="text-white text-5xl font-bold tracking-tight mb-2" style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
                    Vyntra Orbit
                  </h2>
                  <p className="text-white/50 font-medium tracking-wide">
                    Software Development & Design
                  </p>
                </motion.div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
