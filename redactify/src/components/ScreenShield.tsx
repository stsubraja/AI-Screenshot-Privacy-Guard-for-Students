import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, Shield, ShieldAlert, ShieldCheck, Download, Trash2, 
  Eye, EyeOff, Loader2, CheckCircle2, Phone, Mail, User, 
  MapPin, CreditCard, Fingerprint, Sparkles, ArrowRight,
  Lock, Key, Globe, Hash, UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { scanImage } from '../services/gemini';
import { ScanResult, PIIDetection, PIIType } from '../types';
import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getPIIIcon = (type: PIIType) => {
  switch (type) {
    case PIIType.PHONE: return <Phone className="w-4 h-4" />;
    case PIIType.EMAIL: return <Mail className="w-4 h-4" />;
    case PIIType.STUDENT_ID: return <CreditCard className="w-4 h-4" />;
    case PIIType.ADDRESS: return <MapPin className="w-4 h-4" />;
    case PIIType.NAME: return <User className="w-4 h-4" />;
    case PIIType.CREDIT_CARD: return <CreditCard className="w-4 h-4" />;
    case PIIType.SSN: return <Hash className="w-4 h-4" />;
    case PIIType.PASSWORD: return <Lock className="w-4 h-4" />;
    case PIIType.IP_ADDRESS: return <Globe className="w-4 h-4" />;
    case PIIType.USERNAME: return <UserCircle className="w-4 h-4" />;
    default: return <Fingerprint className="w-4 h-4" />;
  }
};

export default function Redactify() {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [detections, setDetections] = useState<PIIDetection[]>([]);
  const [redactionType, setRedactionType] = useState<'blur' | 'black'>('black');
  const [showOriginal, setShowOriginal] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showRedactConfirm, setShowRedactConfirm] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setResult(null);
        setDetections([]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false,
  } as any);

  const handleScan = async () => {
    if (!image) return;
    setIsScanning(true);
    try {
      const scanResult = await scanImage(image);
      setResult(scanResult);
      setDetections(scanResult.detections);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleRedaction = (id: string) => {
    setDetections(prev => prev.map(d => 
      d.id === id ? { ...d, redacted: !d.redacted } : d
    ));
  };

  const redactAll = () => {
    setDetections(prev => prev.map(d => ({ ...d, redacted: true })));
  };

  const clearAll = () => {
    setImage(null);
    setResult(null);
    setDetections([]);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure dimensions match
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (!showOriginal) {
      detections.forEach(d => {
        if (d.redacted) {
          const x = (d.box.xmin / 1000) * canvas.width;
          const y = (d.box.ymin / 1000) * canvas.height;
          const w = ((d.box.xmax - d.box.xmin) / 1000) * canvas.width;
          const h = ((d.box.ymax - d.box.ymin) / 1000) * canvas.height;

          if (redactionType === 'black') {
            ctx.fillStyle = 'black';
            ctx.fillRect(x, y, w, h);
          } else {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
            ctx.filter = 'blur(15px)';
            ctx.drawImage(img, 0, 0);
            ctx.restore();
          }
        }
      });
    }
    setCanvasReady(true);
  }, [image, detections, redactionType, showOriginal]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'redactify-safe-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight gradient-text">Redactify</h1>
              <p className="text-sm text-slate-400 font-semibold">Safe screenshot sharing</p>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-3">
            {image && (
              <motion.button 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={clearAll}
                className="w-10 h-10 glass rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image Display */}
          <div className="lg:col-span-8 space-y-4">
            <AnimatePresence mode="wait">
              {!image ? (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  {...getRootProps()} 
                  className={cn(
                    "aspect-video glass rounded-[40px] flex flex-col items-center justify-center transition-all cursor-pointer relative overflow-hidden group",
                    isDragActive ? "border-indigo-400 bg-indigo-50/50" : "hover:border-indigo-200"
                  )}
                >
                  <input {...getInputProps()} />
                  
                  {/* Decorative background elements */}
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-400 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 right-10 w-32 h-32 bg-cyan-400 rounded-full blur-3xl animate-pulse" />
                  </div>

                  <motion.div 
                    animate={isDragActive ? { scale: 1.2, y: -10 } : { scale: 1 }}
                    className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/10 border border-indigo-50 group-hover:shadow-indigo-500/20 transition-all"
                  >
                    <Upload className="text-indigo-500 w-10 h-10" />
                  </motion.div>
                  
                  <h2 className="text-2xl font-bold text-slate-100">Drop your screenshot</h2>
                  <p className="text-slate-400 font-medium mt-2">PNG or JPG up to 10MB</p>
                  
                  <div className="mt-8 flex gap-3">
                    <span className="px-4 py-2 glass rounded-2xl text-xs font-bold text-indigo-400 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> AI Powered
                    </span>
                    <span className="px-4 py-2 glass rounded-2xl text-xs font-bold text-cyan-400 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> 100% Private
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-[40px] p-4 relative overflow-hidden group"
                >
                  <div className="relative aspect-auto max-h-[70vh] flex justify-center bg-slate-50/50 rounded-[32px] overflow-hidden">
                    <img 
                      ref={imageRef}
                      src={image} 
                      alt="Uploaded" 
                      className={cn(
                        "max-w-full h-auto object-contain transition-opacity duration-500",
                        canvasReady ? "opacity-0" : "opacity-100"
                      )}
                      onLoad={drawCanvas}
                    />
                    <canvas 
                      ref={canvasRef}
                      className={cn(
                        "absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-500",
                        canvasReady ? "opacity-100" : "opacity-0"
                      )}
                    />
                    
                    {/* Scanning Animation */}
                    {isScanning && (
                      <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10"
                      />
                    )}

                    {/* Interactive Detections Overlay */}
                    {result && !showOriginal && (
                      <div className="absolute inset-0 w-full h-full pointer-events-none">
                        {detections.map(d => (
                          <motion.div 
                            key={d.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                              "absolute border-2 transition-all pointer-events-auto cursor-pointer rounded-sm",
                              d.redacted 
                                ? "border-transparent bg-transparent" 
                                : "border-red-500 bg-red-500/10 hover:bg-red-500/20"
                            )}
                            style={{
                              top: `${d.box.ymin / 10}%`,
                              left: `${d.box.xmin / 10}%`,
                              width: `${(d.box.xmax - d.box.xmin) / 10}%`,
                              height: `${(d.box.ymax - d.box.ymin) / 10}%`,
                            }}
                            onClick={() => toggleRedaction(d.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Preview Toggle */}
                    <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setShowOriginal(!showOriginal)}
                        className="glass px-4 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-bold hover:bg-white transition-all shadow-2xl"
                      >
                        {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showOriginal ? 'Hide Original' : 'Preview Original'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Controls & Results */}
          <div className="lg:col-span-4 space-y-6">
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div 
                  key="scan-controls"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass rounded-[40px] p-8 space-y-8"
                >
                  <div className="space-y-3">
                    <h2 className="text-2xl font-extrabold text-slate-100">Ready to scan?</h2>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      Our AI will scan your screenshot for sensitive data like emails, phone numbers, and IDs.
                    </p>
                  </div>
                  
                  <motion.button
                    disabled={!image || isScanning}
                    onClick={handleScan}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full py-5 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all shadow-2xl",
                      !image || isScanning 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                        : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-indigo-500/30"
                    )}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Shield className="w-6 h-6" />
                        Scan Screenshot
                      </>
                    )}
                  </motion.button>

                  <div className="space-y-4 pt-6 border-t border-slate-800">
                    <div className="flex items-center gap-3 text-sm text-slate-400 font-bold">
                      <div className="w-8 h-8 rounded-xl bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      Local Processing
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 font-bold">
                      <div className="w-8 h-8 rounded-xl bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      No Data Storage
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Risk Score Card */}
                  <div className={cn(
                    "rounded-[40px] p-8 border shadow-xl relative overflow-hidden",
                    result.riskScore === 'High' ? "bg-red-900/20 border-red-900/30" :
                    result.riskScore === 'Medium' ? "bg-amber-900/20 border-amber-900/30" :
                    "bg-emerald-900/20 border-emerald-900/30"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {result.riskScore === 'High' ? <ShieldAlert className="text-red-500 w-6 h-6" /> :
                         result.riskScore === 'Medium' ? <ShieldAlert className="text-amber-500 w-6 h-6" /> :
                         <ShieldCheck className="text-emerald-500 w-6 h-6" />}
                        <span className="font-extrabold text-lg text-slate-100">Privacy Risk: {result.riskScore}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{result.summary}</p>
                  </div>

                  {/* Redaction Controls */}
                  <div className="glass rounded-[40px] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-extrabold text-slate-100">Detected PII</h3>
                      <button 
                        onClick={() => setShowRedactConfirm(true)}
                        className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Redact All
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {detections.length === 0 ? (
                        <div className="text-center py-8 space-y-3">
                          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                            <ShieldCheck className="text-emerald-500 w-8 h-8" />
                          </div>
                          <p className="text-sm text-slate-500 font-bold italic">No sensitive data found.</p>
                        </div>
                      ) : (
                        detections.map(d => (
                          <motion.div 
                            key={d.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => toggleRedaction(d.id)}
                            className={cn(
                              "p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between group",
                              d.redacted 
                                ? "bg-slate-800/30 border-slate-800" 
                                : "bg-slate-900 border-slate-700 hover:border-indigo-800 shadow-sm"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                                d.redacted 
                                  ? "bg-slate-700 text-slate-400" 
                                  : "bg-indigo-900/50 text-indigo-400"
                              )}>
                                {getPIIIcon(d.type)}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{d.type}</p>
                                <p className={cn(
                                  "text-sm font-bold truncate max-w-[140px]",
                                  d.redacted ? "line-through text-slate-500" : "text-slate-200"
                                )}>
                                  {d.text}
                                </p>
                              </div>
                            </div>
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                              d.redacted 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                : "bg-slate-800 text-slate-500 group-hover:bg-indigo-900/50 group-hover:text-indigo-400"
                            )}>
                              {d.redacted ? <CheckCircle2 className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    <div className="space-y-6 pt-6 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Style</span>
                        <div className="flex bg-slate-800 p-1.5 rounded-2xl">
                          <button 
                            onClick={() => setRedactionType('black')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                              redactionType === 'black' 
                                ? "bg-slate-700 shadow-md text-white" 
                                : "text-slate-400 hover:text-slate-200"
                            )}
                          >
                            Solid
                          </button>
                          <button 
                            onClick={() => setRedactionType('blur')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                              redactionType === 'blur' 
                                ? "bg-slate-700 shadow-md text-white" 
                                : "text-slate-400 hover:text-slate-200"
                            )}
                          >
                            Blur
                          </button>
                        </div>
                      </div>

                      <motion.button
                        onClick={handleDownload}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-5 bg-indigo-600 text-white rounded-[28px] font-bold flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20 group"
                      >
                        <Download className="w-6 h-6" />
                        Download Safe Image
                        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showRedactConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRedactConfirm(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass relative w-full max-w-md p-8 rounded-[40px] shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-amber-900/30 rounded-3xl flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-amber-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-extrabold text-slate-100">Confirm Redaction</h3>
                <p className="text-slate-400 font-medium">
                  Are you sure you want to redact all detected sensitive information? This action will obscure all identified PII.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRedactConfirm(false)}
                  className="flex-1 py-4 glass rounded-2xl font-bold text-slate-300 hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    redactAll();
                    setShowRedactConfirm(false);
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                >
                  Redact All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
