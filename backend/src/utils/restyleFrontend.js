const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../../../frontend/src/app/page.js');

console.log('Restyling frontend components & inserting Pre-Segregation manual edit console...');

if (!fs.existsSync(pagePath)) {
  console.error(`Page not found at: ${pagePath}`);
  process.exit(1);
}

let content = fs.readFileSync(pagePath, 'utf8');

// 1. Perform automated color replacements (Indigo -> Emerald Jade, Cyan -> Amber Gold)
content = content
  .replace(/\bindigo-600\b/g, 'emerald-600')
  .replace(/\bindigo-500\b/g, 'emerald-500')
  .replace(/\bindigo-400\b/g, 'emerald-400')
  .replace(/\bindigo-700\b/g, 'emerald-700')
  .replace(/\bindigo-900\b/g, 'emerald-900')
  .replace(/\bindigo-950\b/g, 'emerald-950')
  .replace(/\bhover:bg-indigo-500\b/g, 'hover:bg-emerald-500')
  .replace(/\bhover:bg-indigo-600\b/g, 'hover:bg-emerald-600')
  .replace(/\bhover:text-indigo-500\b/g, 'hover:text-emerald-500')
  .replace(/\bhover:bg-indigo-950\/30\b/g, 'hover:bg-emerald-950/30')
  .replace(/\bhover:border-indigo-500\/30\b/g, 'hover:border-emerald-500/30')
  .replace(/\bshadow-indigo-600\/20\b/g, 'shadow-emerald-600/20')
  .replace(/\btext-indigo-500\b/g, 'text-emerald-500')
  .replace(/\btext-indigo-400\b/g, 'text-emerald-400')
  .replace(/\btext-indigo-600\b/g, 'text-emerald-600')
  .replace(/\bbg-indigo-500\/10\b/g, 'bg-emerald-500/10')
  .replace(/\bbg-indigo-500\/5\b/g, 'bg-emerald-500/5')
  .replace(/\bbg-indigo-600\/10\b/g, 'bg-emerald-600/10')
  .replace(/\bbg-indigo-600\b/g, 'bg-emerald-600')
  .replace(/\bbg-indigo-500\b/g, 'bg-emerald-500')
  .replace(/\bborder-indigo-500\/30\b/g, 'border-emerald-500/30')
  .replace(/\bborder-indigo-500\/20\b/g, 'border-emerald-500/20')
  .replace(/\bborder-indigo-500\/25\b/g, 'border-emerald-500/25')
  .replace(/\bactive:scale-95\b/g, 'active:scale-95') // preserve scale
  .replace(/\bcyan-400\b/g, 'amber-400')
  .replace(/\bcyan-500\b/g, 'amber-500')
  .replace(/\bcyan-600\b/g, 'amber-600')
  .replace(/\btext-cyan-400\b/g, 'text-amber-400')
  .replace(/\btext-cyan-500\b/g, 'text-amber-500')
  .replace(/\bbg-cyan-500\/10\b/g, 'bg-amber-500/10')
  .replace(/\bbg-cyan-500\/30\b/g, 'bg-amber-500/30')
  .replace(/\bbg-cyan-950\/30\b/g, 'bg-amber-950/30')
  .replace(/\bborder-cyan-500\/30\b/g, 'border-amber-500/30')
  .replace(/\bborder-cyan-500\/30\b/g, 'border-amber-500/30')
  .replace(/\bhover:border-cyan-500\/30\b/g, 'hover:border-amber-500/30');

// 2. Redesign Recharts color stroke / fill
content = content
  .replace(/stroke="#6366f1"/g, 'stroke="#10b981"')
  .replace(/stopColor="#6366f1"/g, 'stopColor="#10b981"')
  .replace(/stroke="#22d3ee"/g, 'stroke="#f59e0b"')
  .replace(/stopColor="#22d3ee"/g, 'stopColor="#f59e0b"')
  .replace(
    /const\s+colors\s*=\s*\[\s*'#6366f1'\s*,\s*'#10b981'\s*,\s*'#3b82f6'\s*,\s*'#f59e0b'\s*,\s*'#ec4899'\s*\]/g,
    "const colors = ['#10b981', '#059669', '#34d399', '#f59e0b', '#d97706']"
  );

// 3. Update Preloaded sample slip consignment number format to C1000 style
content = content.replace(
  /consignmentNumber:\s*`CN-\$\{Math\.floor\(100000000\s*\+\s*Math\.random\(\)\s*\*\s*900000000\)\}`/g,
  "consignmentNumber: `C${Math.floor(1000 + Math.random() * 9000)}`"
);

// 4. Move theme switcher to header block (top-right corner of the layout)
// Let's locate the header and inject the theme switcher button inside the quick-links block
const headerSearchPattern = `<div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />`;
const headerReplacement = `
            {/* Elegant Top Corner Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 transition-colors border border-slate-250 dark:border-slate-800 cursor-pointer flex items-center justify-center"
              title="Switch Color Theme"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-emerald-500" />}
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
`;
content = content.replace(headerSearchPattern, headerReplacement);

// 5. Replace single card Download button in Tab 2 to have "Review Grid" and "Download" buttons side-by-side
const cardButtonSearch = `<button
                          onClick={() => handleDownloadSegregated(c.name)}
                          className="w-full bg-slate-200 hover:bg-emerald-600 dark:bg-slate-900 dark:hover:bg-emerald-600 text-slate-800 dark:text-white dark:hover:text-white font-bold py-2 rounded-lg text-xs transition-all shadow-md mt-4 flex items-center justify-center gap-1.5 cursor-pointer z-10"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download segregated Excel
                        </button>`;

const cardButtonReplacement = `
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
`;
content = content.replace(cardButtonSearch, cardButtonReplacement);

// 6. Insert review drawer overlay right before the end of the root layout container (main block)
const closingTags = `        </div>
      </main>
    </div>
  );
}`;

const helperDetermineZone = `
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
`;

const reviewDrawerMarkup = `
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
                                    const gst = Number((calculatedBase * 0.18).toFixed(2));
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
                                    const gst = Number((baseVal * 0.18).toFixed(2));
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
                              className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer \${
                                con._isEdited 
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow'
                                  : 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-600 hover:text-white'
                              }\`}
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
      ${helperDetermineZone}
`;

content = content.replace(closingTags, `\n${reviewDrawerMarkup}\n${closingTags}`);

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Restyling completed and Review drawer successfully integrated in page.js!');
