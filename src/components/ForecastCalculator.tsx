/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Languages,
  Check,
  ChevronDown,
  Calculator,
  FileText,
  AlertCircle,
  ClipboardPaste,
  ArrowRight
} from "lucide-react";
import { format, differenceInDays, endOfMonth, startOfMonth, parseISO, isValid, addDays, isBefore, isSameDay } from "date-fns";
import { id, enUS } from "date-fns/locale";
import { ProgressBar } from "./ProgressBar";
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  cn, 
  formatMillion, 
  terbilang, 
  formatCurrencyIDR, 
  formatThousands, 
  stripNonNumeric 
} from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toPng } from "html-to-image";

const translations = {
  id: {
    title: "Forecast Wadidaw",
    subtitle: "Prediksi Automatis",
    download: "Download Laporan PDF",
    inputData: "Input Data",
    netSales: "Penjualan Saat Ini (Net Sales)",
    targetMonthly: "Target Bulanan",
    startDate: "Tanggal Mulai",
    estimateTo: "Estimasi Sampai",
    efficiency: "Efisiensi Target (%)",
    multiplier: "Pengali Estimasi",
    reset: "Reset Data",
    calculate: "Hitung Prediksi",
    readyTitle: "Siap Menghitung",
    readyDesc: "Silakan masukkan data penjualan dan target untuk melihat estimasi.",
    summaryTitle: "Ringkasan Eksekutif",
    achievement: "Estimasi Pencapaian",
    table: {
      title: "Tabel Rincian Prediksi",
      unit: "Nilai dalam Jutaan (JT)",
      hMetric: "Metrik Estimasi",
      hAchievement: "Pencapaian",
      hRemaining: "Prediksi Sisa",
      hForecast: "Total Forecast",
      hTarget: "Target",
      linear: "Estimasi Linear",
      adjusted: "Penyesuaian Efisiensi"
    },
    graph: {
      title: "Grafik Proyeksi Penjualan",
      est: "Estimasi",
      target: "Target"
    },
    cards: {
      forecast: "Prediksi Akhir",
      forecastDesc: "Estimasi total penjualan",
      avg: "Rata-rata Harian",
      avgDesc: "Performa per hari"
    },
    summaryText: {
      current: "Total penjualan saat ini adalah",
      remaining: "Dengan sisa {days} hari ({range}), estimasi total akhir mencapai {total} atau {percent}% dari target.",
      required: "Untuk mencapai target sebesar {target}%, Anda memerlukan rata-rata {avg} per hari pada sisa periode ini."
    }
  },
  en: {
    title: "Forecast Wadidaw",
    subtitle: "Automate Forecast",
    download: "Download PDF Report",
    inputData: "Input Data",
    netSales: "Current Net Sales",
    targetMonthly: "Monthly Target",
    startDate: "Start Date",
    estimateTo: "Estimate Until",
    efficiency: "Target Efficiency (%)",
    multiplier: "Estimation Multiplier",
    reset: "Reset Data",
    calculate: "Calculate Forecast",
    readyTitle: "Ready to Calculate",
    readyDesc: "Please enter sales and target data to see estimations.",
    summaryTitle: "Executive Summary",
    achievement: "Estimated Achievement",
    table: {
      title: "Prediction Details Table",
      unit: "Value in Millions",
      hMetric: "Estimation Metric",
      hAchievement: "Achievement",
      hRemaining: "Remaining Prediction",
      hForecast: "Total Forecast",
      hTarget: "Target",
      linear: "Linear Estimation",
      adjusted: "Efficiency Adjustment"
    },
    graph: {
      title: "Sales Projection Graph",
      est: "Estimation",
      target: "Target"
    },
    cards: {
      forecast: "Final Prediction",
      forecastDesc: "Estimated total sales",
      avg: "Daily Average",
      avgDesc: "Daily performance"
    },
    summaryText: {
      current: "Current total sales is",
      remaining: "With {days} days remaining ({range}), final estimated total is {total} or {percent}% of target.",
      required: "To reach your {target}% target, you need a daily average of {avg} for the rest of period."
    }
  }
};

export function ForecastCalculator() {
  // Input states
  const [netSales, setNetSales] = useState<string>("");
  const [targetSales, setTargetSales] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // App states
  const [lang, setLang] = useState<"id" | "en">("id");
  const [enableTargetPercent, setEnableTargetPercent] = useState<boolean>(false);
  const t = translations[lang];

  // Rest of state
  const [targetPercent, setTargetPercent] = useState<number>(100);
  const [calculatedData, setCalculatedData] = useState<any>(null);
  const [showPasteError, setShowPasteError] = useState<boolean>(false);
  
  // Refs
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Normalization logic for calculation (User types e.g. 738195 for 7.38 Billion)
  const normalize = (val: string) => {
    if (!val) return 0;
    // Multiplier 10,000 converts "Million format cents" to "Full IDR"
    // e.g. 738195 -> 7,381,950,000
    return (parseFloat(stripNonNumeric(val)) || 0) * 10000;
  };

  const handlePaste = async (setter: (val: string) => void) => {
    try {
      setShowPasteError(false);
      const text = await navigator.clipboard.readText();
      const clean = stripNonNumeric(text);
      if (clean) setter(clean);
    } catch (err) {
      console.error("Paste failed", err);
      setShowPasteError(true);
      setTimeout(() => setShowPasteError(false), 6000);
    }
  };

  const calculateForecast = () => {
    const net = normalize(netSales);
    const target = normalize(targetSales);
    const dateStart = parseISO(startDate);
    const dateEnd = parseISO(endDate);

    if (!isValid(dateStart) || !isValid(dateEnd) || target <= 0) return;

    const monthStart = startOfMonth(dateStart);
    
    // Days elapsed from start of month to start date (Reference Date)
    const hariBerjalan = differenceInDays(dateStart, monthStart) + 1;
    
    // Remaining days specified by user (inclusive range)
    const sisaHari = Math.max(differenceInDays(dateEnd, dateStart) + 1, 0);
    
    // Total cycle is from start of month to endDate
    const totalCycleDays = differenceInDays(dateEnd, monthStart) + 1;

    const avgHarian = hariBerjalan > 0 ? net / hariBerjalan : 0;
    
    // Required to reach Simulated Target Percent
    // If slider is 100%, we calculate what's needed for 100% target
    const simulateTargetValue = target * (targetPercent / 100);
    const gap = Math.max(0, simulateTargetValue - net);
    const requiredAvg = sisaHari > 1 ? gap / (sisaHari - 1) : gap;

    // Forecast total based on CURRENT average
    const forecastTotalNormal = net + (avgHarian * Math.max(0, sisaHari - 1));
    
    // Generate chart data for visualization
    const chartData = [];
    const points = Math.min(sisaHari, 30); // Max 30 points to keep chart clean
    const step = Math.max(1, Math.floor(sisaHari / points));
    
    for (let i = 0; i < sisaHari; i += step) {
        const currentDate = addDays(dateStart, i);
        const projectedValue = net + (avgHarian * i);
        const targetLine = net + (requiredAvg * i);
        
        chartData.push({
            name: format(currentDate, "d MMM"),
            forecast: Number((projectedValue / 10000).toFixed(2)),
            required: Number((targetLine / 10000).toFixed(2)),
            fullDate: format(currentDate, "yyyy-MM-dd")
        });
    }

    const currentPersentase = (forecastTotalNormal / target) * 100;

    setCalculatedData({
      hariBerjalan,
      totalHari: totalCycleDays,
      sisaHari,
      avgHarian,
      requiredAvg,
      gap,
      forecastTotal: forecastTotalNormal,
      persentase: currentPersentase,
      target,
      net,
      chartData,
      date: dateStart,
      dateEnd: dateEnd,
      targetPercent
    });
  };

  const downloadPDF = async () => {
    if (!calculatedData) return;
    
    try {
      const doc = new jsPDF() as any;
      const { net, target, forecastTotal, avgHarian, requiredAvg, gap, sisaHari, date, dateEnd, targetPercent } = calculatedData;
      const locale = lang === 'id' ? id : enUS;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(lang === 'id' ? "Laporan Prediksi Penjualan" : "Sales Forecast Report", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`${lang === 'id' ? "Dicetak pada" : "Printed on"}: ${format(new Date(), "dd MMMM yyyy, HH:mm", { locale })}`, 14, 30);
      
      // Info Table
      const infoData = [
        [lang === 'id' ? "Periode Forecast" : "Forecast Period", `${format(date, "dd MMM yyyy", { locale })} - ${format(dateEnd, "dd MMM yyyy", { locale })}`],
        [lang === 'id' ? "Total Hari Estimasi" : "Total Estimation Days", `${sisaHari} ${lang === 'id' ? "Hari" : "Days"}`],
        [lang === 'id' ? "Unit Mata Uang" : "Currency Unit", "IDR (Rupiah)"]
      ];
      
      autoTable(doc, {
        startY: 38,
        head: [[lang === 'id' ? 'Deskripsi' : 'Description', lang === 'id' ? 'Informasi' : 'Information']],
        body: infoData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });
      
      // Values Table
      const valuesData = [
        [lang === 'id' ? "Total Penjualan Saat Ini" : "Total Current Sales", formatCurrencyIDR(net)],
        [lang === 'id' ? "Target Bulanan" : "Monthly Target", formatCurrencyIDR(target)],
        [lang === 'id' ? "Rata-rata Penjualan Per Hari" : "Daily Sales Average", formatCurrencyIDR(avgHarian)],
        [lang === 'id' ? "Prediksi Akhir (Linear)" : "Final Prediction (Linear)", formatCurrencyIDR(forecastTotal)],
        [lang === 'id' ? "Pencapaian Target (%)" : "Target Achievement (%)", `${(forecastTotal / target * 100).toFixed(1)}%`]
      ];
      
      if (gap > 0) {
        valuesData.push([lang === 'id' ? "Kekurangan ke Target" : "Target Shortfall", formatCurrencyIDR(gap)]);
        valuesData.push([lang === 'id' ? `Rata-rata Perlu (untuk hit ${targetPercent}%)` : `Required Average (to hit ${targetPercent}%)`, formatCurrencyIDR(requiredAvg)]);
      }
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [[lang === 'id' ? 'Parameter Keuangan' : 'Financial Parameter', lang === 'id' ? 'Nilai' : 'Value']],
        body: valuesData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }
      });
      
      // Summary text
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(t.summaryTitle, 14, (doc as any).lastAutoTable.finalY + 15);
      
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(summaryText, 180);
      doc.text(splitText, 14, (doc as any).lastAutoTable.finalY + 22);
      
      doc.save(`Forecast-${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleReset = () => {
    setNetSales("");
    setTargetSales("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setEnableTargetPercent(false);
    setTargetPercent(100);
    setCalculatedData(null);
  };

  const getStatus = (percentage: number) => {
    if (percentage >= 100) return { label: "OPTIMAL", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
    if (percentage >= 90) return { label: "WARNING", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
    return { label: "CRITICAL", classes: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
  };

  const summaryText = useMemo(() => {
    if (!calculatedData) return "";
    
    const { net, target, sisaHari, date, dateEnd, forecastTotal, persentase, targetPercent, requiredAvg, gap } = calculatedData;
    const locale = lang === 'id' ? id : enUS;
    const rangeText = `${format(date, "d MMM", { locale })} - ${format(dateEnd, "d MMM yyyy", { locale })}`;
    
    let base = `${t.summaryText.current} Rp ${formatMillion(net)}. ${t.summaryText.remaining.replace('{days}', sisaHari.toString()).replace('{range}', rangeText).replace('{total}', `Rp ${formatMillion(forecastTotal)}`).replace('{percent}', persentase.toFixed(1))}`;
    
    if (gap > 0) {
        base += " " + t.summaryText.required.replace('{target}', targetPercent.toString()).replace('{avg}', `Rp ${formatMillion(requiredAvg)}`);
    }
    
    return base;
  }, [calculatedData, lang]);

  return (
    <div className="min-h-screen bg-teal-500 transition-colors duration-500 font-sans selection:bg-[#D4FF00] selection:text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6" id="calculator-root">
      <div className="futuristic-bg" />
      
      <header className="flex justify-between items-center pb-6 border-b border-white/20 relative z-10" id="header-section">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#3D3D3D] rounded-xl shadow-xl border border-white/10" id="brand-icon">
             <Calculator className="text-[#D4FF00]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight" id="main-title">
              {t.title.split(' ')[0]} <span className="text-[#D4FF00]">{t.title.split(' ')[1]}</span>
            </h1>
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em]" id="main-subtitle">
              {t.subtitle}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3" id="header-actions">
           {/* Language Switcher */}
          <div className="flex bg-[#3D3D3D] border border-white/10 p-1 rounded-xl shadow-lg">
            <button 
              onClick={() => setLang('id')}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", lang === 'id' ? "bg-[#D4FF00] text-slate-900" : "text-white/40 hover:text-white")}
            >ID</button>
            <button 
              onClick={() => setLang('en')}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", lang === 'en' ? "bg-[#D4FF00] text-slate-900" : "text-white/40 hover:text-white")}
            >EN</button>
          </div>

          {calculatedData && (
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl"
              id="btn-download-pdf"
            >
              <FileText size={16} className="text-[#17C3B2]" />
              <span className="hidden sm:inline">{t.download}</span>
            </button>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10" id="main-layout">
        {/* Input Panel */}
        <section className="lg:col-span-4" id="input-panel">
          <div className="dark-card p-8 space-y-8 flex flex-col justify-between" id="input-card">
            <div>
              <h2 className="text-[10px] font-black text-[#D4FF00] uppercase tracking-[0.3em] flex items-center gap-2 mb-8">
                {t.inputData}
              </h2>
              
              <AnimatePresence>
                {showPasteError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-amber-900/20 border border-amber-900/30 p-4 rounded-xl flex items-start gap-3 mb-6"
                    id="paste-error-notification"
                  >
                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-200 font-bold leading-relaxed uppercase tracking-wider">
                      {lang === 'id' ? "Gunakan shortcut" : "Use shortcut"} <span className="text-white bg-white/10 px-1 rounded">OS Shortcut</span> {lang === 'id' ? "untuk menempel data (Paste)." : "to paste data."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
  
              <div className="space-y-6" id="form-fields">
                <div className="space-y-2" id="field-net-sales">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] flex justify-between" htmlFor="net-sales">
                    {t.netSales}
                    <button onClick={() => handlePaste(setNetSales)} className="text-[#D4FF00] hover:brightness-125 transition-colors">
                      <ClipboardPaste size={12} />
                    </button>
                  </label>
                  <div className="relative group">
                    <input
                      id="net-sales"
                      type="text"
                      value={netSales}
                      onChange={(e) => setNetSales(stripNonNumeric(e.target.value))}
                      placeholder="1000"
                      className="w-full px-4 py-3 glass-input text-lg"
                    />
                    {netSales && (
                      <div className="absolute top-full left-0 mt-1.5 text-[8px] font-black uppercase tracking-widest text-[#D4FF00]">
                        Format Juta: <span>{formatMillion(normalize(netSales))}</span>
                      </div>
                    )}
                  </div>
                </div>
  
                <div className="space-y-2" id="field-target-sales">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] flex justify-between" htmlFor="target-sales">
                    {t.targetMonthly}
                    <button onClick={() => handlePaste(setTargetSales)} className="text-[#D4FF00] hover:brightness-125 transition-colors">
                      <ClipboardPaste size={12} />
                    </button>
                  </label>
                  <div className="relative group">
                    <input
                      id="target-sales"
                      type="text"
                      value={targetSales}
                      onChange={(e) => setTargetSales(stripNonNumeric(e.target.value))}
                      placeholder="1500"
                      className="w-full px-4 py-3 glass-input text-lg"
                    />
                    {targetSales && (
                      <div className="absolute top-full left-0 mt-1.5 text-[8px] font-black uppercase tracking-widest text-[#D4FF00]">
                        Format Juta: <span>{formatMillion(normalize(targetSales))}</span>
                      </div>
                    )}
                  </div>
                </div>
  
                <div className="grid grid-cols-2 gap-4" id="date-range-fields">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">{t.startDate}</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D4FF00]" size={12} />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 glass-input text-xs appearance-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">{t.estimateTo}</label>
                    <div className="relative">
                      <ArrowRight className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D4FF00]" size={12} />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 glass-input text-xs appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            <div className="pt-6 border-t border-white/10 space-y-4" id="target-percent-section">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{t.efficiency}</label>
                  <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{t.multiplier}</span>
                </div>
                <button
                  onClick={() => setEnableTargetPercent(!enableTargetPercent)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative flex items-center px-1 shadow-inner",
                    enableTargetPercent ? "bg-[#D4FF00]" : "bg-white/10"
                  )}
                  id="toggle-target-percent"
                >
                  <div className={cn("w-4 h-4 rounded-full bg-white transition-all shadow-sm", enableTargetPercent ? "translate-x-6" : "translate-x-0")} />
                </button>
              </div>
  
              <AnimatePresence>
                {enableTargetPercent && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                    id="target-percent-controls"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="200"
                        value={targetPercent}
                        onChange={(e) => setTargetPercent(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#D4FF00]"
                      />
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={targetPercent}
                          onChange={(e) => setTargetPercent(Math.min(200, Math.max(1, parseInt(e.target.value) || 0)))}
                          className="w-full py-2 px-2 glass-input text-center text-xs font-black outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
  
            <div className="grid grid-cols-2 gap-4 pt-4" id="action-buttons">
              <button
                onClick={handleReset}
                className="py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 border border-white/10 rounded-full hover:bg-white/5 hover:text-white transition-all active:scale-95"
                id="btn-reset"
              >
                {t.reset}
              </button>
              <button
                onClick={calculateForecast}
                disabled={!netSales || !targetSales}
                className="accent-btn py-3 disabled:opacity-50 disabled:grayscale text-sm"
                id="btn-calculate"
              >
                {t.calculate}
              </button>
            </div>
          </div>
        </section>
  
        {/* Output Panel */}
        <section className="lg:col-span-8 flex flex-col" id="output-panel">
          {!calculatedData ? (
            <div className="flex-1 flex flex-col items-center justify-center glass-card rounded-[3rem] p-12 text-center" id="empty-state">
              <div className="w-20 h-20 bg-[#17C3B2]/10 rounded-[2rem] border border-[#17C3B2]/20 flex items-center justify-center mb-8 text-[#17C3B2]">
                <Clock size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t.readyTitle}</h3>
              <p className="text-sm text-slate-500 max-w-xs font-medium leading-relaxed">
                {t.readyDesc}
              </p>
            </div>
          ) : (
            <div ref={dashboardRef} className="space-y-6" id="dashboard-content">
              {/* Summary Text Panel */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-[2.5rem] text-slate-900 shadow-xl relative overflow-hidden flex flex-col items-center text-center gap-4"
                id="summary-panel"
              >
                <div className="p-4 bg-[#17C3B2]/10 rounded-full">
                  <TrendingUp size={32} className="text-[#17C3B2]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#17C3B2]">{t.summaryTitle}</h3>
                  <p className="text-lg font-black leading-[1.6] text-slate-900 max-w-2xl px-4">
                    {summaryText}
                  </p>
                </div>
              </motion.div>
  
              {/* Progress Panel */}
              <div className="glass-card p-8 space-y-4 shadow-lg shadow-black/5" id="progress-indicator-section">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.achievement}</h3>
                    <p className="text-3xl font-black text-slate-900">{calculatedData.persentase.toFixed(1)}%</p>
                  </div>
                </div>
                <ProgressBar progress={calculatedData.persentase} className="py-2" barClassName="bg-[#17C3B2]" />
              </div>
  
              {/* Advanced Data Table  */}
              <div className="glass-card overflow-hidden shadow-lg shadow-black/5" id="breakdown-table-section">
                <div className="px-8 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/10">
                   <h3 className="text-[10px] font-black text-[#17C3B2] uppercase tracking-[0.3em]">{t.table.title}</h3>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.table.unit}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-5 text-left">{t.table.hMetric}</th>
                        <th className="px-8 py-5 text-right">{t.table.hAchievement}</th>
                        <th className="px-8 py-5 text-right">{t.table.hRemaining}</th>
                        <th className="px-8 py-5 text-right">{t.table.hForecast}</th>
                        <th className="px-8 py-5 text-right font-black text-slate-900">{t.table.hTarget}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-[#17C3B2]/5 transition-colors">
                        <td className="px-8 py-5 font-black text-slate-600 tracking-wider">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#17C3B2] shadow-sm" />
                            {t.table.linear}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right tabular-nums text-slate-500 font-medium">{formatMillion(calculatedData.net)}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-slate-500 font-medium">{formatMillion(calculatedData.avgHarian * (calculatedData.sisaHari - 1))}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-[#17C3B2] font-black">{formatMillion(calculatedData.forecastTotal)}</td>
                        <td className="px-8 py-5 text-right tabular-nums text-slate-900 font-black">{formatMillion(calculatedData.target)}</td>
                      </tr>
                      {(calculatedData.gap > 0 || enableTargetPercent) && (
                        <tr className="bg-[#D4FF00]/10">
                          <td className="px-8 py-5 font-black text-slate-900 tracking-widest">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-[#D4FF00] shadow-sm" />
                               <span className="flex items-center gap-2">
                                 {t.table.adjusted}
                                 <span className="text-[9px] bg-[#D4FF00] text-slate-900 px-2 py-0.5 rounded-md font-black">{calculatedData.targetPercent}%</span>
                               </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right tabular-nums text-slate-500 font-medium">{formatMillion(calculatedData.net)}</td>
                          <td className="px-8 py-5 text-right tabular-nums text-slate-500 font-medium">{formatMillion(calculatedData.gap)}</td>
                          <td className="px-8 py-5 text-right tabular-nums text-[#17C3B2] font-black">{formatMillion(calculatedData.target * (calculatedData.targetPercent/100))}</td>
                          <td className="px-8 py-5 text-right tabular-nums text-slate-900 font-black">{formatMillion(calculatedData.target)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
  
              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="kpi-grid">
                <div className="glass-card p-8 flex flex-col gap-6 shadow-lg shadow-black/5">
                   <div className="w-12 h-12 bg-[#17C3B2] text-white rounded-2xl flex items-center justify-center shadow-md">
                      <TrendingUp size={24} />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.cards.forecast}</h3>
                      <p className="text-2xl font-black text-slate-900">{formatMillion(calculatedData.forecastTotal)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase opacity-60 tracking-wider font-medium">{t.cards.forecastDesc}</p>
                   </div>
                </div>
  
                <div className="glass-card p-8 flex flex-col gap-6 shadow-lg shadow-black/5">
                   <div className="w-12 h-12 bg-[#3D3D3D] text-[#D4FF00] rounded-2xl flex items-center justify-center shadow-md">
                      <BarChart3 size={24} />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.cards.avg}</h3>
                      <p className="text-2xl font-black text-slate-900">{formatMillion(calculatedData.avgHarian)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase opacity-60 tracking-wider font-medium">{t.cards.avgDesc}</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
  
      <footer className="py-4 text-center border-t border-white/10 relative z-10 shrink-0" id="footer-section">
        <div className="flex justify-center items-center gap-8 opacity-30 cursor-default">
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white">Analisis Pro</span>
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[#D4FF00]">•</span>
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white">Forecast wadidaw © 2026</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
