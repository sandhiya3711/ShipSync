"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Grid, 
  Camera, 
  Settings, 
  History, 
  LogOut, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Plus, 
  Trash2, 
  Merge, 
  TrendingUp, 
  IndianRupee, 
  Scale, 
  Moon, 
  Sun,
  Shield,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  MapPin
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';


export default function ShipSyncApp() {
  // Safe JSON parser helper to prevent "Unexpected token I" console crashes on HTML/text 500 error pages
  const safeParseJson = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      return { message: text || 'Internal Server Error' };
    }
  };

  // Global States
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard Metrics & Tables States
  const [kpis, setKpis] = useState({
    shipments: 0,
    companies: 0,
    duplicates: 0,
    revenue: 0,
    gst: 0,
    weight: 0,
    totalBilling: 0
  });
  const [companyStats, setCompanyStats] = useState([]);
  const [zoneStats, setZoneStats] = useState([]);
  const [recentUploads, setRecentUploads] = useState([]);
  const [recentShipments, setRecentShipments] = useState([]);
  const [trendStats, setTrendStats] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Excel Segregator States
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileDrag, setExcelFileDrag] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'failed'
  const [uploadResult, setUploadResult] = useState(null);
  const [segregatedCompanies, setSegregatedCompanies] = useState([]);
  const [segregatorSearch, setSegregatorSearch] = useState('');
  const fileInputRef = useRef(null);

  // New review states for manual override console
  const [reviewCompany, setReviewCompany] = useState('');
  const [reviewConsignments, setReviewConsignments] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [savingConsignmentId, setSavingConsignmentId] = useState('');


  // OCR Slip Scanner States
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrForm, setOcrForm] = useState({
    consignmentNumber: '',
    companyName: '',
    rawCompanyName: '',
    orderDate: '',
    destination: '',
    weight: 0.5,
    parcelDetails: 'Scanned via OCR',
    isDuplicate: false,
    baseAmount: 0,
    gstAmount: 0,
    totalAmount: 0,
    zone: 'NORTH/EAST/WEST'
  });
  const [ocrScanCompleted, setOcrScanCompleted] = useState(false);
  const [ocrSaveLoading, setOcrSaveLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState({ text: '', type: '' });
  const ocrImageInputRef = useRef(null);

  // Fuzzy Merge Control States
  const [fuzzyCompanies, setFuzzyCompanies] = useState([]);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeMessage, setMergeMessage] = useState('');

  // Slabs & Rate Settings States
  const [slabs, setSlabs] = useState([]);
  const [zones, setZones] = useState([]);
  const [slabsLoading, setSlabsLoading] = useState(true);
  const [showAddSlab, setShowAddSlab] = useState(false);
  const [newSlab, setNewSlab] = useState({
    minWeight: 0.0,
    maxWeight: 1.0,
    baseRate: 50.0,
    excessRatePerKg: 40.0,
    zone: 'CHENNAI'
  });
  const [slabMessage, setSlabMessage] = useState('');
  
  // Zone rate editing state
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editZoneBaseCharge, setEditZoneBaseCharge] = useState('');
  const [editZoneGst, setEditZoneGst] = useState('');

  // Toast Notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const sessionExpiredRef = useRef(false);

  // Toast Trigger Helper
  const showToast = (message, type = 'success') => {
    if (sessionExpiredRef.current && message !== 'Your session has expired. Please log in again.') {
      return;
    }
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // Handle Logout
  const handleLogout = (isExpired = false) => {
    if (isExpired) {
      sessionExpiredRef.current = true;
    } else {
      sessionExpiredRef.current = false;
    }
    setToken('');
    setUser(null);
    localStorage.removeItem('shipsync_token');
    localStorage.removeItem('shipsync_user');
    if (isExpired) {
      showToast('Your session has expired. Please log in again.', 'error');
    } else {
      showToast('Logged out successfully.');
    }
    setActiveTab('dashboard');
  };

  // Shadow global fetch to intercept 401/403 errors and auto-logout
  const fetch = async (url, options = {}) => {
    const globalFetch = typeof window !== 'undefined' ? window.fetch : globalThis.fetch;
    if (!globalFetch) return;
    const res = await globalFetch(url, options);
    if ((res.status === 401 || res.status === 403) && token) {
      handleLogout(true);
    }
    return res;
  };

  // Trigger LocalStorage recovery
  useEffect(() => {
    const savedToken = localStorage.getItem('shipsync_token');
    const savedUser = localStorage.getItem('shipsync_user');
    const savedTheme = localStorage.getItem('shipsync_theme');

    Promise.resolve().then(() => {
      if (savedTheme === 'light') {
        setDarkMode(false);
        document.documentElement.removeAttribute('data-theme');
      } else {
        setDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    });
  }, []);

  // Fetch Dashboard Data
  const fetchDashboardMetrics = async (activeToken) => {
    try {
      setDashboardLoading(true);
      const res = await fetch(`${BACKEND_URL}/dashboard/metrics`, {
        headers: { 'Authorization': `Bearer ${activeToken || token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setKpis(data.kpis);
        setCompanyStats(data.companyStats);
        setZoneStats(data.zoneStats);
        setRecentUploads(data.recentUploads);
        setRecentShipments(data.recentShipments);
        setTrendStats(data.trendStats);
      }
    } catch (e) {
      console.error('Error fetching metrics:', e);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Fetch Segregated Companies list
  const fetchSegregatedCompaniesList = async (activeToken) => {
    try {
      const res = await fetch(`${BACKEND_URL}/excel/companies`, {
        headers: { 'Authorization': `Bearer ${activeToken || token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setSegregatedCompanies(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch consignments for the company being manually edited
  const fetchReviewConsignments = async (companyName) => {
    try {
      setReviewLoading(true);
      setReviewCompany(companyName);
      const res = await fetch(`${BACKEND_URL}/excel/companies/${encodeURIComponent(companyName)}/consignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setReviewConsignments(data);
      } else {
        showToast('Failed to load company consignments.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error communicating with backend.', 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  // Save manual weight/cost overrides for a consignment row
  const handleUpdateConsignment = async (consignmentId, weight, cost) => {
    try {
      setSavingConsignmentId(consignmentId);
      const res = await fetch(`${BACKEND_URL}/excel/consignments/${consignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ weight, baseAmount: cost })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Consignment saved successfully!');
        // Update local review state
        setReviewConsignments(prev => prev.map(item => 
          item.id === consignmentId ? data.consignment : item
        ));
        // Refresh dashboard metrics in background
        fetchDashboardMetrics();
        // Refresh segregated companies summaries
        fetchSegregatedCompaniesList();
      } else {
        showToast(data.message || 'Failed to save consignment edits.', 'error');
      }
    } catch (e) {
      showToast('Error communicating with backend.', 'error');
    } finally {
      setSavingConsignmentId('');
    }
  };


  // Fetch Slabs & Zones
  const fetchSlabsAndZones = async (activeToken) => {
    try {
      setSlabsLoading(true);
      const resSlabs = await fetch(`${BACKEND_URL}/billing/slabs`, {
        headers: { 'Authorization': `Bearer ${activeToken || token}` }
      });
      const slabsData = await safeParseJson(resSlabs);
      
      const resZones = await fetch(`${BACKEND_URL}/billing/zones`, {
        headers: { 'Authorization': `Bearer ${activeToken || token}` }
      });
      const zonesData = await safeParseJson(resZones);

      if (resSlabs.ok) setSlabs(slabsData);
      if (resZones.ok) setZones(zonesData);
    } catch (e) {
      console.error(e);
    } finally {
      setSlabsLoading(false);
    }
  };

  // Fetch Fuzzy Companies Lists
  const fetchFuzzyCompanies = async (activeToken) => {
    try {
      const res = await fetch(`${BACKEND_URL}/billing/fuzzy-companies`, {
        headers: { 'Authorization': `Bearer ${activeToken || token}` }
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        setFuzzyCompanies(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Admin Update Zone Rates (Dynamic Recalculation)
  const handleUpdateZone = async (zoneName) => {
    try {
      const res = await fetch(`${BACKEND_URL}/billing/zones/${encodeURIComponent(zoneName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          baseCharge: Number(editZoneBaseCharge),
          gstPercent: Number(editZoneGst)
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Zone rates updated and shipments re-calculated successfully!');
        setEditingZoneId(null);
        fetchSlabsAndZones();
        fetchDashboardMetrics();
      } else {
        showToast(data.message || 'Failed to update zone rates.', 'error');
      }
    } catch (e) {
      showToast('Error communicating with server.', 'error');
    }
  };

  // Helper to determine zone based on destination string
  const getZoneFromDestination = (destination) => {
    if (!destination) return 'NORTH/EAST/WEST';
    const dest = destination.toUpperCase().trim();
    if (dest.includes('CHENNAI')) return 'CHENNAI';
    if (dest.includes('HYDERABAD')) return 'HYDERABAD';
    if (dest.includes('TAMIL NADU')) return 'TAMIL NADU';
    if (dest.includes('SOUTH')) return 'SOUTH INDIA';
    return 'NORTH/EAST/WEST';
  };

  // Helper to get dynamic GST rate from database zones settings
  const getGstPercentForDestination = (destination) => {
    const zoneName = getZoneFromDestination(destination);
    const zoneSetting = zones.find(z => z.zone.toUpperCase() === zoneName.toUpperCase());
    return zoneSetting ? zoneSetting.gstPercent : 18.0;
  };

  // Effect to load page data when token or tab changes
  useEffect(() => {
    if (token) {
      Promise.resolve().then(() => {
        // Always pre-load slabs & zones for calculations
        fetchSlabsAndZones();

        if (activeTab === 'dashboard') {
          fetchDashboardMetrics();
        } else if (activeTab === 'segregator') {
          fetchSegregatedCompaniesList();
        } else if (activeTab === 'ocr') {
          fetchFuzzyCompanies();
        }
      });
    }
  }, [token, activeTab]);



  // Light/Dark Theme Switcher
  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shipsync_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('shipsync_theme', 'light');
    }
  };

  // Handle User Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Please enter username and password');
      return;
    }

    try {
      setLoginError('');
      setLoginLoading(true);
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await safeParseJson(res);

      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('shipsync_token', data.token);
        localStorage.setItem('shipsync_user', JSON.stringify(data.user));
        showToast(`Welcome back, ${data.user.name}!`);
        fetchDashboardMetrics(data.token);
      } else {
        setLoginError(data.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setLoginError('Failed to connect to API server.');
    } finally {
      setLoginLoading(false);
    }
  };



  // Admin Clear DB records
  const handleClearDatabase = async () => {
    if (!confirm('WARNING: This will permanently delete all shipments, segregated records, and upload logs! Slabs and canonical settings will be preserved. Are you sure?')) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/excel/clear`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('All consignment database records wiped successfully.');
        fetchDashboardMetrics();
      } else {
        showToast('Only administrators can clear database records.', 'error');
      }
    } catch (e) {
      showToast('Error communication with backend API.', 'error');
    }
  };

  // Pre-load direct login badge click helper
  const handleQuickLogin = (uname, pwd) => {
    setUsername(uname);
    setPassword(pwd);
  };

  // Excel Drag Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setExcelFileDrag(true);
  };

  const handleDragLeave = () => {
    setExcelFileDrag(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setExcelFileDrag(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetExcel(files[0]);
    }
  };

  const validateAndSetExcel = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Unsupported file type. Please upload .xlsx, .xls or .csv.', 'error');
      return;
    }
    setExcelFile(file);
    setUploadState('idle');
    setUploadProgress(0);
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      validateAndSetExcel(files[0]);
    }
  };

  // Execute Master Excel Segregation Upload
  const handleExcelUpload = async () => {
    if (!excelFile) return;

    try {
      setUploadState('uploading');
      
      // Simulated visual progress bar animation
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 150);

      const formData = new FormData();
      formData.append('file', excelFile);

      const res = await fetch(`${BACKEND_URL}/excel/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      clearInterval(interval);
      setUploadProgress(100);

      const resData = await safeParseJson(res);
      if (res.ok) {
        setUploadState('success');
        setUploadResult(resData.data);
        showToast(`Parsed ${resData.data.successRows} shipments successfully!`);
        fetchSegregatedCompaniesList();
      } else {
        setUploadState('failed');
        showToast(resData.message || 'Failed to process master Excel sheet.', 'error');
      }
    } catch (e) {
      setUploadState('failed');
      showToast('Error uploading sheet. Please check backend connection.', 'error');
    }
  };

  // Download Sample Master Excel Template file
  const handleDownloadSampleTemplate = () => {
    fetch(`${BACKEND_URL}/excel/sample`)
    .then(async (res) => {
      if (!res.ok) {
        showToast('Error downloading sample template.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_shipping_ledger.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Downloaded sample_shipping_ledger.xlsx!');
    })
    .catch(() => showToast('Failed to download sample template.', 'error'));
  };

  // Download Company-Segregated Excel file
  const handleDownloadSegregated = (companyName) => {
    window.open(`${BACKEND_URL}/excel/download/${encodeURIComponent(companyName)}?token=${token}`, '_blank');
    
    // Fallback streaming via fetch if token requires headers
    fetch(`${BACKEND_URL}/excel/download/${encodeURIComponent(companyName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async (res) => {
      if (!res.ok) {
        showToast('Error downloading file.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Downloaded ${companyName}.xlsx!`);
    })
    .catch(() => showToast('Failed to download excel.', 'error'));
  };

  // OCR Image Drop / Change Handlers
  const handleOcrImageChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      const file = files[0];
      setOcrImage(file);
      setOcrScanCompleted(false);
      setOcrMessage({ text: '', type: '' });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setOcrPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Load a direct logistic slip sample for fast testing
  const handleLoadSampleSlip = async () => {
    setOcrLoading(true);
    setOcrMessage({ text: 'Simulating OCR slip analysis pipeline...', type: 'info' });
    
    // Simulate API delay for OCR extraction on our seeded slip invoice
    setTimeout(() => {
      const sampleForm = {
        consignmentNumber: `C${Math.floor(1000 + Math.random() * 9000)}`,
        companyName: 'Alfred Pvt Ltd',
        rawCompanyName: 'Alfred Corporate Cargo Co',
        orderDate: '2026-05-27',
        destination: 'Chennai, Tamil Nadu (MAA)',
        weight: 0.35, // 350 grams
        parcelDetails: 'Sample Logistics label scanned - weight 350g',
        isDuplicate: false,
        baseAmount: 42.00, // Chennai 250-500g slab is 42
        gstAmount: 7.56,   // 18% of 42
        totalAmount: 49.56,
        zone: 'CHENNAI'
      };

      setOcrForm(sampleForm);
      setOcrScanCompleted(true);
      setOcrLoading(false);
      setOcrMessage({ text: 'OCR extracted successfully! (Mapped to CHENNAI Zone, 250g-500g Slab @ ₹42.00 base rate + 18% GST). Feel free to edit values before saving.', type: 'success' });
      showToast('Extracted OCR slip metrics!');
    }, 1500);
  };

  // Process Real OCR on backend
  const handleOcrProcess = async () => {
    if (!ocrImage) return;

    try {
      setOcrLoading(true);
      setOcrScanCompleted(false);
      setOcrMessage({ text: 'Connecting to Tesseract.js pipeline on Node backend (running scan regex patterns)...', type: 'info' });

      const formData = new FormData();
      formData.append('image', ocrImage);

      const res = await fetch(`${BACKEND_URL}/ocr/scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const resData = await safeParseJson(res);
      if (res.ok) {
        setOcrForm(resData.data);
        setOcrScanCompleted(true);
        setOcrMessage({ text: 'OCR Extraction Successful! Parsed weight: ' + resData.data.weight + ' kg. Auto-mapped to Zone: ' + resData.data.zone, type: 'success' });
        showToast('OCR parsing completed!');
      } else {
        setOcrMessage({ text: resData.message || 'OCR parsing failed. Image might be blurry.', type: 'error' });
        showToast('OCR slip scan failed.', 'error');
      }
    } catch (e) {
      setOcrMessage({ text: 'Communication error with OCR endpoint.', type: 'error' });
      showToast('Backend connection failed.', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  // Calculate live amount when editing OCR Form weight / destination manually
  const handleOcrFormEdit = async (field, value) => {
    const updated = { ...ocrForm, [field]: value };
    
    // Live re-calculate cost locally / triggers backend calc for exact values
    if (field === 'weight' || field === 'destination') {
      try {
        const wtVal = Number(updated.weight) || 0.5;
        const destVal = updated.destination || 'National';

        // Fast local prediction or simple fetch
        // Let's call the billing calculation endpoint or just let backend save recalculate.
        // We can do it local based on standard slabs for awesome dynamic feedback!
        let calculatedBase = 70.00;
        let matchedZone = 'NORTH/EAST/WEST';
        
        const normalizedDest = destVal.toUpperCase();
        if (normalizedDest.includes('CHENNAI')) {
          matchedZone = 'CHENNAI';
          calculatedBase = wtVal <= 0.25 ? 40 : wtVal <= 0.5 ? 42 : 45;
        } else if (normalizedDest.includes('HYDERABAD')) {
          matchedZone = 'HYDERABAD';
          calculatedBase = wtVal <= 0.25 ? 75 : wtVal <= 0.5 ? 75 : 80;
        } else if (normalizedDest.includes('TAMIL NADU')) {
          matchedZone = 'TAMIL NADU';
          calculatedBase = wtVal <= 0.25 ? 65 : wtVal <= 0.5 ? 68 : 70;
        } else if (normalizedDest.includes('SOUTH')) {
          matchedZone = 'SOUTH INDIA';
          calculatedBase = wtVal <= 0.25 ? 75 : wtVal <= 0.5 ? 78 : 80;
        } else {
          matchedZone = 'NORTH/EAST/WEST';
          calculatedBase = wtVal <= 0.25 ? 100 : wtVal <= 0.5 ? 150 : 230;
        }

        const gstPercent = getGstPercentForDestination(updated.destination);
        updated.zone = matchedZone;
        updated.baseAmount = calculatedBase;
        updated.gstAmount = Number((calculatedBase * (gstPercent / 100)).toFixed(2));
        updated.totalAmount = Number((calculatedBase + updated.gstAmount).toFixed(2));
      } catch (e) {
        console.error(e);
      }
    }
    setOcrForm(updated);
  };

  // Save the OCR Parsed Shipment to the database
  const handleOcrSaveShipment = async (e) => {
    e.preventDefault();
    try {
      setOcrSaveLoading(true);
      const res = await fetch(`${BACKEND_URL}/ocr/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ocrForm)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Successfully saved OCR consignment to records!');
        setOcrScanCompleted(false);
        setOcrImage(null);
        setOcrPreview(null);
        setOcrMessage({ text: 'Consignment ' + ocrForm.consignmentNumber + ' saved to database! Stats updated.', type: 'success' });
        fetchFuzzyCompanies(); // reload list
      } else {
        showToast(data.message || 'Error saving consignment.', 'error');
      }
    } catch (e) {
      showToast('Failed to save consignment.', 'error');
    } finally {
      setOcrSaveLoading(false);
    }
  };

  // Handle Fuzzy Merging
  const handleMergeCompanies = async (e) => {
    e.preventDefault();
    if (!mergeSource || !mergeTarget) {
      setMergeMessage('Please select both a source and target company.');
      return;
    }

    try {
      setMergeLoading(true);
      setMergeMessage('');
      const res = await fetch(`${BACKEND_URL}/billing/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceCompanyId: mergeSource,
          targetCompanyId: mergeTarget
        })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Companies merged successfully!');
        setMergeMessage(data.message);
        setMergeSource('');
        setMergeTarget('');
        fetchFuzzyCompanies(); // refresh list
      } else {
        setMergeMessage(data.message || 'Merge action failed.');
      }
    } catch (err) {
      setMergeMessage('Error communicating with merge API.');
    } finally {
      setMergeLoading(false);
    }
  };

  // Handle Admin Add weight slab
  const handleAddSlab = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/billing/slabs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSlab)
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        showToast('Weight slab created successfully!');
        setShowAddSlab(false);
        setNewSlab({
          minWeight: 0.0,
          maxWeight: 1.0,
          baseRate: 50.0,
          excessRatePerKg: 40.0,
          zone: 'CHENNAI'
        });
        fetchSlabsAndZones();
      } else {
        setSlabMessage(data.message || 'Failed to create weight slab.');
      }
    } catch (e) {
      setSlabMessage('Error contacting server.');
    }
  };

  // Handle Admin Delete weight slab
  const handleDeleteSlab = async (slabId) => {
    if (!confirm('Are you sure you want to delete this weight slab?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/billing/slabs/${slabId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Weight slab deleted successfully.');
        fetchSlabsAndZones();
      } else {
        showToast('Forbidden: Admin only permissions.', 'error');
      }
    } catch (e) {
      showToast('Error communicating with server.', 'error');
    }
  };

  // Quick helper to filter search results on company segregation lists
  const filteredSegregatedCompanies = segregatedCompanies.filter(c => 
    c.name.toLowerCase().includes(segregatorSearch.toLowerCase()) || 
    (c.aliases && c.aliases.toLowerCase().includes(segregatorSearch.toLowerCase()))
  );

  // Render Login Layout if not authenticated
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center relative overflow-hidden p-4">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Brand Header */}
        <div className="z-10 text-center mb-8 animate-float">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Logistics Systems
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white font-outfit">
            Ship<span className="text-emerald-400">Sync</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
            AI-powered Courier Billing, Segregation & Excel Automation Console
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="w-full max-w-md z-10 glass-panel rounded-2xl border border-slate-800 p-8 shadow-2xl relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-slate-900 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-lg">
            <Layers className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>

          <h2 className="text-xl font-bold text-center text-white mt-8 mb-6 font-outfit">
            Portal Authentication
          </h2>

          {loginError && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Username
              </label>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or employee"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Password
              </label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Console
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-fill Badge Helpers */}
          <div className="mt-8 border-t border-slate-800/80 pt-6">
            <span className="block text-xs text-slate-500 mb-3 text-center">
              Quick Dev Access (Seeded Logins):
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleQuickLogin('admin', 'admin123')}
                className="px-3 py-2 bg-slate-900 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/30 rounded-lg text-left text-xs transition-all cursor-pointer"
              >
                <span className="block text-slate-400 font-semibold mb-0.5">Admin Profile</span>
                <span className="text-slate-500">admin / admin123</span>
              </button>
              <button 
                onClick={() => handleQuickLogin('employee', 'employee123')}
                className="px-3 py-2 bg-slate-900 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/30 rounded-lg text-left text-xs transition-all cursor-pointer"
              >
                <span className="block text-slate-400 font-semibold mb-0.5">Employee Profile</span>
                <span className="text-slate-500">employee / employee123</span>
              </button>
            </div>
          </div>
        </div>

        <div className="z-10 mt-8 text-slate-500 text-xs">
          ShipSync Corp Limited © 2026. Secured by JWT & PBKDF2 cryptography.
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col text-slate-900 dark:text-slate-100 ${darkMode ? 'dark' : ''}`}>
      {/* Sleek Top Navigation Bar */}
      <header className="h-20 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-20 sticky top-0 shadow-sm">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-400 flex items-center justify-center shadow-md">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight dark:text-white font-outfit leading-none">
              Ship<span className="text-emerald-500 dark:text-emerald-400">Sync</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
              AI Logistics SaaS
            </span>
          </div>
        </div>

        {/* Middle: Horizontal Tabs Nav List */}
        <nav className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview Console
          </button>

          <button
            onClick={() => setActiveTab('segregator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'segregator'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Segregator
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'ocr'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900/50'
            }`}
          >
            <Camera className="w-4 h-4" />
            OCR Label Scanner
          </button>

          <button
            onClick={() => setActiveTab('slabs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'slabs'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Billing Rates Card
          </button>
        </nav>

        {/* Right: User Badge, Theme Toggle, Clear db & Logout */}
        <div className="flex items-center gap-4">
          {/* User badge */}
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center gap-2.5 shrink-0">
            <div className="w-6.5 h-6.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="overflow-hidden leading-none">
              <span className="block text-[11px] font-bold truncate dark:text-slate-200">{user.name}</span>
              <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-emerald-500 bg-emerald-500/10 px-1 rounded uppercase mt-0.5">
                <Shield className="w-2 h-2" /> {user.role}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          {user.role === 'ADMIN' && (
            <button 
              onClick={handleClearDatabase}
              className="px-3 py-1.5 bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Clear Consignment Database"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Records
            </button>
          )}

          {/* Elegant Top Corner Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 transition-colors border border-slate-250 dark:border-slate-800 cursor-pointer flex items-center justify-center"
            title="Switch Color Theme"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-emerald-500" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors cursor-pointer flex items-center justify-center"
            title="Log Out of Platform"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-[9px] hidden xl:inline">API Online</span>
          </div>
        </div>
      </header>

      {/* Main Panel Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">

        {/* Global Toast */}
        {toast.show && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-float ${
            toast.type === 'error' 
              ? 'bg-red-950/80 border-red-500/40 text-red-300' 
              : 'bg-emerald-950/80 border-emerald-500/40 text-indigo-300'
          }`}>
            {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-6 space-y-6">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {dashboardLoading ? (
                <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="text-sm text-slate-400 font-semibold">Aggregating database KPIs & charts...</span>
                </div>
              ) : (
                <>
                  {/* KPI Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* KPI 1 */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between glass-card-hover">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Shipments</span>
                        <h3 className="text-2xl font-extrabold font-outfit text-slate-900 dark:text-white">
                          {kpis.shipments}
                        </h3>
                        <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" /> Live records
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                    </div>

                    {/* KPI 2 */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between glass-card-hover">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Gross Freight Billing</span>
                        <h3 className="text-2xl font-extrabold font-outfit text-slate-900 dark:text-white">
                          ₹{kpis.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-semibold block">Before 18% GST</span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <IndianRupee className="w-5 h-5" />
                      </div>
                    </div>

                    {/* KPI 3 */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between glass-card-hover">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Accrued Tax (GST)</span>
                        <h3 className="text-2xl font-extrabold font-outfit text-slate-900 dark:text-white">
                          ₹{kpis.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-semibold block">Total 18% Accruals</span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <IndianRupee className="w-5 h-5" />
                      </div>
                    </div>

                    {/* KPI 4 */}
                    <div className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between glass-card-hover">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Duplicate tracking numbers</span>
                        <h3 className="text-2xl font-extrabold font-outfit text-slate-900 dark:text-white">
                          {kpis.duplicates}
                        </h3>
                        {kpis.duplicates > 0 ? (
                          <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3 animate-pulse" /> Action needed
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-bold block">Perfect Integrity</span>
                        )}
                      </div>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        kpis.duplicates > 0 
                          ? 'bg-red-500/10 border border-red-500/30 text-red-400' 
                          : 'bg-slate-500/10 border border-slate-500/30 text-slate-400'
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Line Chart */}
                    <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 lg:col-span-2">
                      <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" /> Shipping Volume & Billing Trends
                      </h3>
                      <div className="h-72">
                        {trendStats.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#e2e8f0"} />
                              <XAxis dataKey="date" stroke={darkMode ? "#94a3b8" : "#475569"} fontSize={10} />
                              <YAxis stroke={darkMode ? "#94a3b8" : "#475569"} fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: darkMode ? '#111827' : '#ffffff', borderColor: darkMode ? '#374151' : '#e2e8f0', color: darkMode ? '#ffffff' : '#000000' }} />
                              <Area type="monotone" dataKey="revenue" name="Total Bill (₹)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                              <Area type="monotone" dataKey="shipments" name="Shipment Count" stroke="#f59e0b" strokeWidth={1} fill="none" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400">
                            Upload a master Excel file to render volume trends
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Zone Share Pie */}
                    <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5">
                      <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-400" /> Geographic Zone Distribution
                      </h3>
                      <div className="h-44 flex items-center justify-center">
                        {zoneStats.some(z => z.shipments > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={zoneStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={4}
                                dataKey="shipments"
                                nameKey="zone"
                              >
                                {zoneStats.map((entry, index) => {
                                  const colors = ['#10b981', '#059669', '#34d399', '#f59e0b', '#d97706'];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-xs text-slate-400">
                            No shipments data loaded yet
                          </div>
                        )}
                      </div>
                      
                      {/* Zone Legend */}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {zoneStats.map((item, idx) => {
                          const colors = ['#10b981', '#059669', '#34d399', '#f59e0b', '#d97706'];
                          return (
                            <div key={item.zone} className="flex items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-lg border border-slate-200/50 dark:border-slate-850">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                              <div className="overflow-hidden">
                                <span className="block text-[10px] font-bold uppercase truncate dark:text-slate-300">{item.zone}</span>
                                <span className="text-[10px] text-slate-400 font-semibold block">{item.shipments} shipments</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Lower Row tables */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Shipments table */}
                    <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 lg:col-span-2">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                          Recent Shipments
                        </h3>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          Live Ledger
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-2.5">Consignment No</th>
                              <th className="py-2.5">Date</th>
                              <th className="py-2.5">Company Name</th>
                              <th className="py-2.5">Destination</th>
                              <th className="py-2.5 text-right">Weight</th>
                              <th className="py-2.5 text-right">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentShipments.length > 0 ? (
                              recentShipments.map((ship) => (
                                <tr key={ship.id} className="border-b border-slate-200/50 dark:border-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-colors">
                                  <td className="py-3 font-semibold font-mono flex items-center gap-1.5">
                                    {ship.consignmentNumber}
                                    {ship.isDuplicate && (
                                      <span className="px-1 text-[8px] font-extrabold text-red-500 bg-red-500/10 border border-red-500/30 rounded uppercase shrink-0">
                                        Dup
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 text-slate-400">{ship.orderDate}</td>
                                  <td className="py-3 font-medium truncate max-w-[120px]">{ship.companyName}</td>
                                  <td className="py-3 truncate max-w-[100px]">{ship.destination}</td>
                                  <td className="py-3 text-right text-slate-400">{ship.weight.toFixed(3)} kg</td>
                                  <td className="py-3 text-right font-bold text-emerald-400">₹{ship.totalAmount.toFixed(2)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-slate-450">
                                  No shipments in database. Go to Excel Segregator or OCR Scanner to upload records!
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right: Upload history logs */}
                    <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5">
                      <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 mb-4">
                        Recent Activity Log
                      </h3>

                      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                        {recentUploads.length > 0 ? (
                          recentUploads.map((log) => (
                            <div key={log.id} className="p-3 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded-xl flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="overflow-hidden">
                                  <span className="block text-xs font-bold truncate dark:text-slate-200">{log.filename}</span>
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.uploadedBy}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                                  log.status === 'SUCCESS' 
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                    : log.status === 'PROCESSING' 
                                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse'
                                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                                }`}>
                                  {log.status}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-200/50 dark:border-slate-800/60 pt-2 mt-1">
                                <span>Entries Parsed: <b className="text-slate-350">{log.shipmentsCount} rows</b></span>
                                <span className="font-semibold text-emerald-400 uppercase tracking-wider">{log.uploadType.replace('_', ' ')}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-xs text-slate-450">
                            No uploads completed yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: EXCEL SEGREGATOR */}
          {activeTab === 'segregator' && (
            <div className="space-y-6">
              {/* Uploader Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 lg:col-span-1 space-y-4">
                  <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                    Upload Master Excel
                  </h3>
                  
                  {/* File Dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all ${
                      excelFileDrag
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-slate-300 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/40 bg-slate-100/30 dark:bg-slate-900/10'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                    />

                    {excelFile ? (
                      <div className="space-y-2">
                        <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto" />
                        <span className="block text-xs font-bold text-slate-300 truncate max-w-[200px]">
                          {excelFile.name}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {(excelFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-10 h-10 text-slate-400 mx-auto animate-float" />
                        <span className="block text-xs font-bold">Drag and drop file here</span>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                          or click to browse (.xlsx, .xls, .csv)
                        </span>
                      </div>
                    )}
                  </div>

                  {!excelFile && (
                    <button
                      onClick={handleDownloadSampleTemplate}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-emerald-400 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Sample Master Sheet (.xlsx)
                    </button>
                  )}

                  {excelFile && (
                    <div className="space-y-3">
                      {uploadState === 'uploading' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                            <span>Processing Excel Sheets...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {uploadState === 'success' && uploadResult && uploadResult.successRows > 0 && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-white font-bold text-xs shadow-lg animate-float">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>Successfully segregated & parsed {uploadResult.successRows} of {uploadResult.totalRows} rows! {uploadResult.duplicateRows > 0 && `(${uploadResult.duplicateRows} duplicates skipped)`}</span>
                        </div>
                      )}

                      {uploadState === 'success' && uploadResult && uploadResult.successRows === 0 && uploadResult.duplicateRows > 0 && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl flex flex-col gap-1.5 text-white text-xs shadow-lg leading-relaxed">
                          <div className="flex items-center gap-2 font-bold text-amber-400">
                            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                            <span>Warning: Duplicate Entries Skipped</span>
                          </div>
                          <span className="text-[10px] text-slate-350">
                            All <b>{uploadResult.duplicateRows} consignment numbers</b> in this spreadsheet already exist in the database! To upload them again, please click the <b>Clear Records</b> button in the top right to wipe previous history.
                          </span>
                        </div>
                      )}

                      {uploadState === 'success' && uploadResult && uploadResult.successRows === 0 && (!uploadResult.duplicateRows || uploadResult.duplicateRows === 0) && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl flex flex-col gap-1.5 text-white text-xs shadow-lg leading-relaxed">
                          <div className="flex items-center gap-2 font-bold text-amber-400">
                            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                            <span>Warning: Columns Mismatched (0 Rows Segregated)</span>
                          </div>
                          <span className="text-[10px] text-slate-350">
                            The sheet contains <b>{uploadResult.totalRows} rows</b>, but no matching consignment or company columns were identified. Please verify your sheet has headers like <b>CILENT</b>, <b>DOCKET NO</b>, and <b>Recipient&apos;s name and address</b>.
                          </span>
                        </div>
                      )}

                      {uploadState === 'failed' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Processing failed. Check sheet structure.</span>
                        </div>
                      )}

                      <button
                        onClick={handleExcelUpload}
                        disabled={uploadState === 'uploading'}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {uploadState === 'uploading' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Segregating Records...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Process & Segregate File
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Info block */}
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 lg:col-span-2 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" /> Automatic Company Segregation Engine
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload a unified Logistics ledger Excel file containing records from multiple companies. The ShipSync pipeline automatically:
                    </p>
                    <ul className="space-y-2 text-xs text-slate-400 list-disc pl-4 leading-relaxed">
                      <li>Parses standard column headers (Consignment No, Client, Destination, Weight).</li>
                      <li>Executes the <b>Fuzzy matching AI matcher</b>, merging entries from spellings like <i>Alfred Pvt Ltd</i>, <i>ALFRED</i>, and <i>Alfred Co</i> under the parent profile.</li>
                      <li>Calculates costs for each package using slabs (Tamil Nadu, South India, Hyderabad, etc.).</li>
                      <li>Aggregates the listings into <b>styled standalone client spreadsheets</b> ready to export in 1 click!</li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/25 rounded-xl flex items-start gap-2.5 mt-4">
                    <Info className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-bold text-emerald-400">Excel Formatting Standard:</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        For pristine exports, the sheet should contain: <b>Company Name</b>, <b>Consignment Number</b>, <b>Destination</b>, <b>Order Date</b>, and <b>Weight</b> (handles raw decimals, grams, and text units automatically).
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Segregated Companies Grid */}
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-800/60 pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                    Segregated Client Portfolios
                  </h3>
                  
                  {/* Search bar */}
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-450 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="Search company or alias..."
                      value={segregatorSearch}
                      onChange={(e) => setSegregatorSearch(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {filteredSegregatedCompanies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredSegregatedCompanies.map((c) => (
                      <div key={c.id} className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between glass-card-hover relative overflow-hidden group">
                        {/* Faded background icon */}
                        <FileSpreadsheet className="w-24 h-24 text-emerald-500/5 absolute -right-6 -bottom-6 group-hover:scale-110 transition-transform duration-300" />
                        
                        <div className="space-y-3 z-10">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold truncate dark:text-white" title={c.name}>{c.name}</h4>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              {c.shipmentsCount} Consignments
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-450 border-t border-b border-slate-200/50 dark:border-slate-800/40 py-2.5">
                            <div>
                              <span className="block text-[10px] text-slate-500">Gross Weight:</span>
                              <span className="font-semibold text-slate-350">{c.totalWeight.toFixed(2)} kg</span>
                            </div>
                            <div>
                                <span className="block text-[10px] text-slate-500">Net Cost:</span>
                                <span className="font-semibold text-emerald-400 font-outfit font-bold">₹{c.totalRevenue.toFixed(2)}</span>
                              </div>
                          </div>

                          {c.aliases && (
                            <div className="text-[10px]">
                              <span className="text-slate-500 block">Identified Spellings:</span>
                              <span className="text-slate-400 italic font-mono truncate block max-w-[200px]" title={c.aliases}>
                                {c.aliases}
                              </span>
                            </div>
                          )}
                        </div>

                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <button
                            onClick={() => fetchReviewConsignments(c.name)}
                            className="bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold py-2 rounded-lg text-xs transition-all shadow-sm border border-emerald-500/25 flex items-center justify-center gap-1 cursor-pointer z-10"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Review Grid
                          </button>
                          <button
                            onClick={() => handleDownloadSegregated(c.name)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer z-10"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel border border-slate-200 dark:border-slate-800/80 rounded-2xl py-16 text-center text-slate-450">
                    <FileSpreadsheet className="w-12 h-12 text-slate-500 mx-auto mb-3 animate-pulse" />
                    <span className="block text-sm font-bold">No Segregated Company Records Found</span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Use the Excel drag-and-drop panel to upload a master shipping spreadsheet!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OCR LABEL SCANNER */}
          {activeTab === 'ocr' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Uploader Left */}
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 lg:col-span-1 space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                      Scan Slip Label
                    </h3>
                    <button 
                      onClick={handleLoadSampleSlip}
                      className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/30 rounded-full flex items-center gap-1 cursor-pointer transition-all hover:bg-emerald-500 hover:text-white shadow"
                    >
                      <Sparkles className="w-3 h-3" /> Pre-load Sample Slip
                    </button>
                  </div>

                  <div
                    onClick={() => ocrImageInputRef.current?.click()}
                    className={`h-52 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all ${
                      ocrImage
                        ? 'border-emerald-500'
                        : 'border-slate-300 dark:border-slate-800 hover:border-emerald-500 bg-slate-100/30 dark:bg-slate-900/10'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={ocrImageInputRef} 
                      onChange={handleOcrImageChange} 
                      className="hidden" 
                      accept="image/*"
                    />

                    {ocrPreview ? (
                      <div className="relative w-full h-full rounded-lg overflow-hidden group">
                        <img 
                          src={ocrPreview} 
                          alt="Slip Scanned" 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
                          Click to Replace Image
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Camera className="w-10 h-10 text-slate-400 mx-auto animate-pulse" />
                        <span className="block text-xs font-bold">Upload Cargo Slip / Invoice</span>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                          Supports PNG, JPG, WEBP labels
                        </span>
                      </div>
                    )}
                  </div>

                  {ocrImage && (
                    <button
                      onClick={handleOcrProcess}
                      disabled={ocrLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {ocrLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Running OCR scanner...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          Execute OCR Text Extraction
                        </>
                      )}
                    </button>
                  )}

                  {ocrMessage.text && (
                    <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1 ${
                      ocrMessage.type === 'error' 
                        ? 'bg-red-500/10 border-red-500/20 text-red-300' 
                        : ocrMessage.type === 'info'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-indigo-300'
                    }`}>
                      <span className="block font-bold uppercase tracking-wider text-[9px] mb-1">OCR Terminal Output:</span>
                      <span>{ocrMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Form Editing Right */}
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 lg:col-span-2">
                  <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-1.5">
                    <Layers className="w-4.5 h-4.5 text-emerald-400" /> Extracted Structured Shipment Data
                  </h3>

                  {ocrScanCompleted ? (
                    <form onSubmit={handleOcrSaveShipment} className="space-y-4">
                      {/* Alert warnings if duplicate */}
                      {ocrForm.isDuplicate && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-400 text-xs">
                          <AlertTriangle className="w-4.5 h-4.5 shrink-0 animate-pulse" />
                          <div>
                            <span className="font-bold block">Duplicate tracking number detected!</span>
                            <span className="block text-[10px] text-slate-400">Saving this shipment will flag it in your duplicates overview ledger.</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Consignment No */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Consignment Number (AWB)
                          </label>
                          <input 
                            type="text"
                            value={ocrForm.consignmentNumber}
                            onChange={(e) => handleOcrFormEdit('consignmentNumber', e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        {/* Company Name */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Fuzzy Canonical Company Match
                          </label>
                          <select
                            value={ocrForm.companyName}
                            onChange={(e) => handleOcrFormEdit('companyName', e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          >
                            <option value="">-- Mapped Canonical --</option>
                            {fuzzyCompanies.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Raw Company Name */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Raw Name Extracted
                          </label>
                          <input 
                            type="text"
                            value={ocrForm.rawCompanyName}
                            onChange={(e) => handleOcrFormEdit('rawCompanyName', e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Date Extracted
                          </label>
                          <input 
                            type="date"
                            value={ocrForm.orderDate}
                            onChange={(e) => handleOcrFormEdit('orderDate', e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        {/* Weight */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Package Weight (kg)
                          </label>
                          <input 
                            type="number"
                            step="0.001"
                            value={ocrForm.weight}
                            onChange={(e) => handleOcrFormEdit('weight', e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        {/* Destination */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Destination (City or Province)
                          </label>
                          <input 
                            type="text"
                            value={ocrForm.destination}
                            onChange={(e) => handleOcrFormEdit('destination', e.target.value)}
                            placeholder="e.g. Chennai, Tamil Nadu"
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Calculated rates output */}
                      <div className="p-4 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-xl mt-6 space-y-3">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Live Freight Billing Calculations (Automated rates)
                        </span>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Matched Slab Zone:</span>
                            <span className="font-bold text-emerald-400 uppercase">{ocrForm.zone}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Base Freight Charge:</span>
                            <span className="font-bold text-slate-300">₹{ocrForm.baseAmount.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">GST Accrued (18%):</span>
                            <span className="font-bold text-slate-350">₹{ocrForm.gstAmount.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Total Accrued Cost:</span>
                            <span className="font-bold text-emerald-400 font-outfit text-sm">₹{ocrForm.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => setOcrScanCompleted(false)}
                          className="px-4 py-2 border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all hover:bg-slate-900 cursor-pointer"
                        >
                          Reset Scan
                        </button>
                        <button
                          type="submit"
                          disabled={ocrSaveLoading}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          {ocrSaveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Confirm & Save Shipment
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="h-64 border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center text-slate-450">
                      <Camera className="w-12 h-12 text-slate-500 mb-3" />
                      <span className="block text-sm font-bold">No label scan processed yet</span>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Select a scanned parcel image file or click <b>&quot;Pre-load Sample Slip&quot;</b> above!
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fuzzy merge manager down below */}
              <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Merge className="w-4.5 h-4.5 text-emerald-400 animate-pulse" /> Fuzzy matching group Manager
                  </h3>
                  <p className="text-xs text-slate-400">
                    If the system identifies two variations of a company name (e.g. <i>Alfred Co</i> and <i>Alfred Pvt Ltd</i>), an administrator can merge them below. All historic consignments will be updated under the canonical Target name, and the Source name will be mapped as a hard alias mapping so future uploads auto-segregate instantly!
                  </p>
                </div>

                {mergeMessage && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
                    <Info className="w-4.5 h-4.5 shrink-0" />
                    <span>{mergeMessage}</span>
                  </div>
                )}

                <form onSubmit={handleMergeCompanies} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  {/* Select Source */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      1. Select Source Company (To be merged)
                    </label>
                    <select
                      value={mergeSource}
                      onChange={(e) => setMergeSource(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">-- Select Source --</option>
                      {fuzzyCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c._count?.consignments || 0} rows)</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Target */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      2. Select Target Canonical Company (Parent profile)
                    </label>
                    <select
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">-- Select Target --</option>
                      {fuzzyCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={mergeLoading || user.role !== 'ADMIN'}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {mergeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
                    {user.role === 'ADMIN' ? 'Execute Company Merge' : 'Requires Admin Rights'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: BILLING & RATE SETTINGS */}
          {activeTab === 'slabs' && (
            <div className="space-y-6">
              {/* Slab list */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Slabs Table Left */}
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                        Weight Slabs Tariff Registry
                      </h3>
                      <span className="block text-[10px] text-slate-500">Configures Courier & Cargo Limited billing structures</span>
                    </div>

                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => setShowAddSlab(!showAddSlab)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add tariff Slab
                      </button>
                    )}
                  </div>

                  {/* Dynamic Add Form */}
                  {showAddSlab && (
                    <form onSubmit={handleAddSlab} className="p-4 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4 animate-float">
                      <span className="block text-xs font-bold text-emerald-400">Insert New Weight Slab Rate</span>
                      
                      {slabMessage && (
                        <span className="block text-xs text-red-400 bg-red-950/20 px-2 py-1 rounded">{slabMessage}</span>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Zone */}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Zone</label>
                          <select
                            value={newSlab.zone}
                            onChange={(e) => setNewSlab({ ...newSlab, zone: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                            required
                          >
                            {zones.map(z => <option key={z.id} value={z.zone}>{z.zone}</option>)}
                          </select>
                        </div>
                        {/* Min */}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Min Wt (kg)</label>
                          <input
                            type="number"
                            step="0.001"
                            value={newSlab.minWeight}
                            onChange={(e) => setNewSlab({ ...newSlab, minWeight: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            required
                          />
                        </div>
                        {/* Max */}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Max Wt (kg)</label>
                          <input
                            type="number"
                            step="0.001"
                            value={newSlab.maxWeight}
                            onChange={(e) => setNewSlab({ ...newSlab, maxWeight: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            required
                          />
                        </div>
                        {/* Base Rate */}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Base Rate ($)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={newSlab.baseRate}
                            onChange={(e) => setNewSlab({ ...newSlab, baseRate: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            required
                          />
                        </div>
                        {/* Excess Rate */}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Excess Rate/kg</label>
                          <input
                            type="number"
                            step="0.1"
                            value={newSlab.excessRatePerKg}
                            onChange={(e) => setNewSlab({ ...newSlab, excessRatePerKg: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/40">
                        <button
                          type="button"
                          onClick={() => setShowAddSlab(false)}
                          className="px-3 py-1 border border-slate-800 hover:bg-slate-850 rounded text-xs text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold cursor-pointer"
                        >
                          Save Slab Rate
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Tariff Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5">Zone Category</th>
                          <th className="py-2.5 text-right">Min weight</th>
                          <th className="py-2.5 text-right">Max weight</th>
                          <th className="py-2.5 text-right">Base rate</th>
                          <th className="py-2.5 text-right">Excess Rate / kg</th>
                          {user.role === 'ADMIN' && <th className="py-2.5 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {slabs.length > 0 ? (
                          slabs.map((slab) => (
                            <tr key={slab.id} className="border-b border-slate-200/50 dark:border-slate-850 hover:bg-slate-900/10 transition-colors font-mono">
                              <td className="py-3 font-semibold dark:text-slate-200 font-sans uppercase">{slab.zone}</td>
                              <td className="py-3 text-right text-slate-400">{(slab.minWeight * 1000).toFixed(0)}g ({(slab.minWeight).toFixed(3)}kg)</td>
                              <td className="py-3 text-right text-slate-400">{(slab.maxWeight * 1000).toFixed(0)}g ({(slab.maxWeight).toFixed(3)}kg)</td>
                              <td className="py-3 text-right font-bold text-slate-200">₹{slab.baseRate.toFixed(2)}</td>
                              <td className="py-3 text-right text-slate-400">₹{slab.excessRatePerKg.toFixed(2)}</td>
                              {user.role === 'ADMIN' && (
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => handleDeleteSlab(slab.id)}
                                    className="p-1 text-red-500 hover:bg-red-500/15 rounded transition-all cursor-pointer inline-flex"
                                    title="Delete tariff slab"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-slate-450">
                              No weight slabs configured in database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Zones Summary Right */}
                <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 space-y-4">
                  <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-400">
                    Geographic Zones Settings
                  </h3>

                  <div className="space-y-3">
                    {zones.map(z => {
                      const isEditing = editingZoneId === z.id;
                      return isEditing ? (
                        <div key={z.id} className="p-3 bg-slate-100/55 dark:bg-slate-900/60 border border-emerald-500/40 dark:border-emerald-500/30 rounded-xl space-y-3 shadow-lg">
                          <div className="flex items-center justify-between">
                            <span className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">{z.zone}</span>
                            <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-1 rounded font-bold uppercase">Editing</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base Charge (₹)</label>
                              <input 
                                type="number"
                                value={editZoneBaseCharge}
                                onChange={(e) => setEditZoneBaseCharge(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">GST (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                value={editZoneGst}
                                onChange={(e) => setEditZoneGst(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/40">
                            <button
                              onClick={() => setEditingZoneId(null)}
                              className="px-2.5 py-1 text-[10px] font-bold text-slate-450 hover:text-white transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateZone(z.zone)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={z.id} className="p-3 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-850 rounded-xl flex items-center justify-between hover:border-slate-700/50 transition-all">
                          <div>
                            <span className="block text-xs font-bold dark:text-slate-200 uppercase">{z.zone}</span>
                            <span className="text-[10px] text-slate-450 block mt-0.5">Base Charge: ₹{z.baseCharge.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="block text-xs font-bold text-emerald-400">{z.gstPercent.toFixed(1)}% GST</span>
                              <span className="text-[10px] text-slate-500 block">Accrued on Net</span>
                            </div>
                            {user && user.role === 'ADMIN' && (
                              <button
                                onClick={() => {
                                  setEditingZoneId(z.id);
                                  setEditZoneGst(z.gstPercent);
                                  setEditZoneBaseCharge(z.baseCharge);
                                }}
                                className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-700/80 dark:border-slate-800 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer shadow-sm"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">GST Compliant Billing:</span>
                      <span className="block text-[10px] text-slate-400 leading-relaxed mt-1">
                        All zone parameters accrue GST at a standard rate of **18.00%** on top of the net slab base rate and excess cargo fees, conforming to standard logistics taxation directives.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


      {/* Interactive Review Drawer Modal for Manual Overrides (Idea A) */}
      {reviewCompany && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="w-full max-w-5xl h-[85vh] glass-panel border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative">
            {/* Glow accent */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-250 dark:border-slate-800/80 pb-4 mb-4 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-450">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-outfit text-slate-900 dark:text-white flex items-center gap-2">
                    Quotation Review Console: <span className="text-emerald-400 font-extrabold">{reviewCompany}</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    Review parsed weights and costs. Edit columns directly below to save manual pricing overrides.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setReviewCompany('')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-250 dark:border-slate-800 text-xs font-bold"
              >
                ✕ Close Review
              </button>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 z-10">
              {reviewLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="text-xs text-slate-450 font-bold">Retrieving shipment sheets from database...</span>
                </div>
              ) : reviewConsignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5">Consignment No</th>
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Destination (Zone)</th>
                        <th className="py-2.5">Weight (kg)</th>
                        <th className="py-2.5">Base cost (₹)</th>
                        <th className="py-2.5">GST (18%)</th>
                        <th className="py-2.5">Total cost</th>
                        <th className="py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewConsignments.map((con) => (
                        <tr key={con.id} className="border-b border-slate-200/50 dark:border-slate-850 hover:bg-slate-900/10 transition-colors">
                          <td className="py-3 font-semibold font-mono text-slate-800 dark:text-slate-100">
                            {con.consignmentNumber}
                          </td>
                          <td className="py-3 text-slate-450">{con.orderDate}</td>
                          <td className="py-3 font-medium text-slate-400">
                            {con.destination} 
                            <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded ml-2">
                              {determineZoneLocal(con.destination)}
                            </span>
                          </td>
                          <td className="py-2">
                            <input 
                              type="number" 
                              step="0.01"
                              defaultValue={con.weight}
                              onChange={(e) => {
                                const wtVal = Number(e.target.value) || 0;
                                let calculatedBase = 70.00;
                                const dest = con.destination.toUpperCase();
                                
                                if (dest.includes('CHENNAI')) {
                                  calculatedBase = wtVal <= 0.25 ? 40 : wtVal <= 0.5 ? 42 : 45;
                                } else if (dest.includes('HYDERABAD')) {
                                  calculatedBase = wtVal <= 0.25 ? 75 : wtVal <= 0.5 ? 75 : 80;
                                } else if (dest.includes('TAMIL NADU')) {
                                  calculatedBase = wtVal <= 0.25 ? 65 : wtVal <= 0.5 ? 68 : 70;
                                } else if (dest.includes('SOUTH')) {
                                  calculatedBase = wtVal <= 0.25 ? 75 : wtVal <= 0.5 ? 78 : 80;
                                } else {
                                  calculatedBase = wtVal <= 0.25 ? 100 : wtVal <= 0.5 ? 150 : 230;
                                }
                                
                                setReviewConsignments(prev => prev.map(item => {
                                  if (item.id === con.id) {
                                    const gstPercent = getGstPercentForDestination(con.destination);
                                    const gst = Number((calculatedBase * (gstPercent / 100)).toFixed(2));
                                    const tot = Number((calculatedBase + gst).toFixed(2));
                                    return { ...item, weight: wtVal, baseAmount: calculatedBase, gstAmount: gst, totalAmount: tot, _isEdited: true };
                                  }
                                  return item;
                                }));
                              }}
                              className="w-20 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </td>
                          <td className="py-2">
                            <input 
                              type="number" 
                              step="0.5"
                              value={con.baseAmount}
                              onChange={(e) => {
                                const baseVal = Number(e.target.value) || 0;
                                setReviewConsignments(prev => prev.map(item => {
                                  if (item.id === con.id) {
                                    const gstPercent = getGstPercentForDestination(con.destination);
                                    const gst = Number((baseVal * (gstPercent / 100)).toFixed(2));
                                    const tot = Number((baseVal + gst).toFixed(2));
                                    return { ...item, baseAmount: baseVal, gstAmount: gst, totalAmount: tot, _isEdited: true };
                                  }
                                  return item;
                                }));
                              }}
                              className="w-24 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-amber-400 text-xs font-bold focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </td>
                          <td className="py-3 text-slate-400 font-semibold font-mono">
                            ₹{con.gstAmount.toFixed(2)}
                          </td>
                          <td className="py-3 text-slate-850 dark:text-emerald-450 font-bold font-mono">
                            ₹{con.totalAmount.toFixed(2)}
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => handleUpdateConsignment(con.id, con.weight, con.baseAmount)}
                              disabled={savingConsignmentId === con.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                                con._isEdited 
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow'
                                  : 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-600 hover:text-white'
                              }`}
                            >
                              {savingConsignmentId === con.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              {con._isEdited ? 'Save Change' : 'Saved'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No shipments available in this client portfolio.
                </div>
              )}
            </div>

            {/* Footer Summary / Download */}
            <div className="border-t border-slate-250 dark:border-slate-800/80 pt-4 mt-4 flex items-center justify-between z-10">
              <div className="flex gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Shipments: <b className="text-white font-mono">{reviewConsignments.length}</b></span>
                <span>Gross Weight: <b className="text-white font-mono">{reviewConsignments.reduce((sum, item) => sum + item.weight, 0).toFixed(2)} kg</b></span>
                <span>Net Total: <b className="text-emerald-400 font-mono">₹{reviewConsignments.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewCompany('')}
                  className="px-4 py-2 border border-slate-250 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-xs font-bold text-slate-400 transition-all cursor-pointer"
                >
                  Close Grid
                </button>
                <button
                  onClick={() => {
                    handleDownloadSegregated(reviewCompany);
                    setReviewCompany('');
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download Segregated Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}

function determineZoneLocal(destination) {
  if (!destination) return 'NORTH/EAST/WEST';
  const dest = destination.toUpperCase().trim();
  if (dest.includes('CHENNAI') || dest === 'MAA') return 'CHENNAI';
  if (dest.includes('HYDERABAD') || dest === 'HYD') return 'HYDERABAD';
  if (dest.includes('TAMIL NADU') || dest === 'TN') return 'TAMIL NADU';
  const southIndiaKeywords = ['SOUTH INDIA', 'KARNATAKA', 'KERALA', 'ANDHRA PRADESH', 'TELANGANA', 'BANGALORE', 'BENGALURU', 'KOCHI', 'COIMBATORE', 'MADURAI', 'TRICHY'];
  if (southIndiaKeywords.some(kw => dest.includes(kw))) return 'SOUTH INDIA';
  return 'NORTH/EAST/WEST';
}

