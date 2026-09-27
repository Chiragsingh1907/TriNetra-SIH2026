import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Search, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import NetworkGraph from './NetworkGraph';

const API_BASE = 'http://localhost:8000/api';

const TriNetraLogo = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rawText, setRawText] = useState("");
  const [formData, setFormData] = useState({
      case_summary: "",
      identified_suspects: [],
      identified_plaintiffs: [],
      phone_anchors: [],
      financial_anchors: [],
      vehicle_anchors: []
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [firs, setFirs] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  
  const [graphData, setGraphData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const fetchFirs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/firs`);
      if (res.data?.firs) setFirs(res.data.firs);
    } catch (e) {
      console.warn('Could not fetch FIR list', e);
    }
  };

  useEffect(() => {
    fetchFirs();
  }, []);

  useEffect(() => {
    if (graphData) {
      const edges = graphData.edges;
      const nodes = graphData.nodes;
      
      const nexusNode = nodes.reduce((max, node) => 
          (node.metrics?.betweenness_centrality || 0) > (max.metrics?.betweenness_centrality || 0) ? node : max
      , { metrics: { betweenness_centrality: 0 } });

      if (nexusNode && nexusNode.metrics?.betweenness_centrality > 0.4 && nexusNode.label !== 'Case') {
          const connectedFIRs = edges
              .filter(edge => edge.from === nexusNode.id || edge.to === nexusNode.id)
              .map(edge => edge.from === nexusNode.id ? edge.to : edge.from)
              .filter(id => {
                  const node = nodes.find(n => n.id === id);
                  return node && (node.label === 'Case' || String(node.name).startsWith('FIR_'));
              });

          const uniqueFIRs = [...new Set(connectedFIRs)];

          if (uniqueFIRs.length >= 2) {
              const nodeName = nexusNode.name || nexusNode.label || "Unknown Entity";
              const score = parseFloat(nexusNode.metrics.betweenness_centrality).toFixed(2);
              setAlertMsg(`🚨 ALERT: Syndicate detected! Nexus [${nodeName}] (Centrality: ${score}) bridges ${uniqueFIRs.length} distinct cases.`);
              return;
          }
      }
      setAlertMsg(null);
    } else {
      setAlertMsg(null);
    }
  }, [graphData]);

  const loadFir = async (caseId) => {
    setIsLoading(true);
    try {
        const response = await fetch(`${API_BASE}/cases/${caseId}`);
        if (!response.ok) throw new Error("Failed to fetch case data");
        const data = await response.json();

        setRawText(data.raw_text);
        setFormData({
            case_summary: data.case_summary || "",
            identified_suspects: data.identified_suspects || [],
            identified_plaintiffs: data.identified_plaintiffs || [],
            phone_anchors: data.phone_anchors || [],
            financial_anchors: data.financial_anchors || [],
            vehicle_anchors: data.vehicle_anchors || []
        });

        // Normally we'd call networkInstance.focus() here if we had a ref to the graph instance
    } catch (err) {
        console.error("Error loading case:", err);
        alert('Failed to load FIR.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleUploadClick = () => {
      if (!uploadFile) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target.result;
          setShowUpload(false);
          await handleUpload(text);
      };
      reader.readAsText(uploadFile);
  };

  const handleUpload = async (text) => {
      // 1. Immediately set the raw text so the UI doesn't go blank
      setRawText(text);
      setIsExtracting(true);
      
      try {
          const response = await fetch(`${API_BASE}/upload_fir`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: text })
          });

          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.detail || `Server error: ${response.status}`);
          }

          const data = await response.json();
          
          // 2. Safely merge the backend data into the frontend state
          setFormData({
              case_summary: data.case_summary || "",
              identified_suspects: data.identified_suspects || [],
              identified_plaintiffs: data.identified_plaintiffs || [],
              phone_anchors: data.phone_anchors || [],
              financial_anchors: data.financial_anchors || [],
              vehicle_anchors: data.vehicle_anchors || []
          });
          setGraphData(null); 
          setUploadFile(null);

      } catch (error) {
          console.error("Upload failed:", error);
          alert(`Extraction Failed: ${error.message}. Please check the backend logs.`);
      } finally {
          setIsExtracting(false);
      }
  };

  const commitFir = async () => {
    if (!rawText || !formData) return;
    setIsLoading(true);
    
    // Pass strictly validated arrays
    const payload = {
      fir_id: crypto.randomUUID(),
      raw_text: rawText,
      case_summary: formData.case_summary,
      identified_plaintiffs: formData.identified_plaintiffs || [],
      identified_suspects: formData.identified_suspects || [],
      phone_anchors: formData.phone_anchors || [],
      financial_anchors: formData.financial_anchors || [],
      vehicle_anchors: formData.vehicle_anchors || []
    };

    try {
      await axios.post(`${API_BASE}/commit_fir`, payload);
      alert('Verified data securely committed to Knowledge Graph');
      
      const analyticsRes = await axios.get(`${API_BASE}/analytics`);
      setGraphData(analyticsRes.data);
      
      fetchFirs(); 
    } catch (e) {
      console.error(e);
      alert('Commit failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFir = async (firId) => {
    if (!window.confirm("Are you sure you want to permanently delete this FIR and its network links?")) return;
    
    setIsLoading(true);
    try {
      await axios.delete(`${API_BASE}/fir/${firId}`);
      alert("FIR deleted successfully.");
      fetchFirs();
      
      const analyticsRes = await axios.get(`${API_BASE}/analytics`);
      setGraphData(analyticsRes.data);
      
      if (searchQuery === firId) setSearchQuery("");
    } catch (e) {
      console.error(e);
      alert("Failed to delete FIR.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearWorkspace = () => {
    setRawText("");
    setFormData({
        case_summary: "",
        identified_suspects: [],
        identified_plaintiffs: [],
        phone_anchors: [],
        financial_anchors: [],
        vehicle_anchors: []
    });
    setGraphData(null); 
    setAlertMsg(null);
  };

  const handleWipeDatabase = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete all FIRs and nodes from the Neo4j database. Continue?")) return;
    
    try {
        const response = await fetch(`${API_BASE}/clear_database`, { method: 'DELETE' });
        if (response.ok) {
            alert("Database successfully wiped.");
            handleClearWorkspace();
            fetchFirs();
        }
    } catch (error) {
        console.error("Failed to wipe database:", error);
    }
  };

  const handleFieldChange = (field, index, value) => {
    if (field === 'case_summary') {
      setFormData(prev => ({ ...prev, case_summary: value }));
    } else {
      const newList = [...formData[field]];
      newList[index] = value;
      setFormData(prev => ({ ...prev, [field]: newList }));
    }
  };

  const handleAddField = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeField = (field, index) => {
      const newList = [...formData[field]];
      newList.splice(index, 1);
      setFormData(prev => ({ ...prev, [field]: newList }));
  };

  const renderArrayField = (label, fieldKey) => (
    <div className="mb-4 bg-[#393E46] border border-[#00ADB5]/50 p-3 rounded-lg shadow-sm">
      <h3 className="font-semibold mb-2 text-[#00FFF5] text-xs uppercase">{label}</h3>
      {formData[fieldKey].length === 0 ? (
        <p className="text-xs text-[#00ADB5]">Empty list</p>
      ) : null}
      {formData[fieldKey].map((val, idx) => (
        <div key={idx} className="flex mb-2 gap-2">
          <input
            className="w-full bg-[#222831] border border-[#00ADB5]/50 rounded px-3 py-1.5 text-sm text-[#EEEEEE] focus:border-[#00FFF5] focus:ring-1 focus:ring-[#00FFF5] focus:outline-none flex-grow transition-colors"
            value={val}
            onChange={(e) => handleFieldChange(fieldKey, idx, e.target.value)}
          />
          <button onClick={() => removeField(fieldKey, idx)} className="text-[#00ADB5] hover:text-[#00FFF5] font-bold px-2 transition-colors">X</button>
        </div>
      ))}
      <button
        onClick={() => handleAddField(fieldKey)}
        className="mt-2 text-[#222831] bg-[#00ADB5] hover:bg-[#00FFF5] font-semibold text-xs rounded px-3 py-1.5 transition-colors"
      >
        + Add {label}
      </button>
    </div>
  );

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen w-screen flex items-center justify-center bg-[#222831] font-sans selection:bg-[#00ADB5] selection:text-[#222831]">
              <div className="w-full max-w-md bg-[#393E46] border border-[#00ADB5]/50 shadow-[0_0_30px_rgba(0,173,181,0.2)] rounded-xl p-8">
                  <div className="flex flex-col items-center justify-center mb-8 text-[#EEEEEE]">
                      <TriNetraLogo className="w-16 h-16 mb-4 text-[#00FFF5]" />
                      <h1 className="text-3xl font-black tracking-widest uppercase text-[#00FFF5]">TriNetra</h1>
                      <p className="text-xs text-[#00ADB5] tracking-widest mt-2 uppercase font-medium">Classified Intelligence Terminal</p>
                  </div>
                  
                  <form onSubmit={(e) => { e.preventDefault(); setIsAuthenticated(true); }} className="space-y-5">
                      <div>
                          <label className="block text-xs font-semibold text-[#00ADB5] uppercase tracking-wider mb-2">Officer Badge ID</label>
                          <input 
                              type="text" 
                              required
                              className="w-full bg-[#222831] border border-[#00ADB5]/50 text-[#EEEEEE] placeholder-[#393E46] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00FFF5] focus:ring-1 focus:ring-[#00FFF5] transition-all"
                              placeholder="Enter Badge ID"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-semibold text-[#00ADB5] uppercase tracking-wider mb-2">Secure Passkey</label>
                          <input 
                              type="password" 
                              required
                              className="w-full bg-[#222831] border border-[#00ADB5]/50 text-[#EEEEEE] placeholder-[#393E46] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00FFF5] focus:ring-1 focus:ring-[#00FFF5] transition-all"
                              placeholder="••••••••"
                          />
                      </div>
                      <button 
                          type="submit" 
                          className="w-full bg-[#00ADB5] hover:bg-[#00FFF5] text-[#222831] font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-widest mt-4 text-xs shadow-[0_0_15px_rgba(0,173,181,0.4)]"
                      >
                          Access Terminal
                      </button>
                  </form>
                  
                  <div className="mt-8 pt-6 border-t border-[#00ADB5]/30 text-center">
                      <p className="text-[10px] text-[#00ADB5]/70 uppercase tracking-wider">
                          Warning: Unauthorized access to this system is a federal offense punishable under the IT Act. All connection attempts are logged.
                      </p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen w-screen bg-[#222831] text-[#EEEEEE] overflow-hidden font-sans">
      {/* Loading Overlay */}
      {(isLoading || isExtracting) && (
        <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#00FFF5] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[#00FFF5] font-bold tracking-widest uppercase">Processing...</p>
        </div>
      )}

      {/* Alert Notification */}
      {alertMsg && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-900 border border-red-500 text-red-100 px-4 py-3 rounded shadow-lg animate-pulse">
          <span className="block sm:inline font-bold">{alertMsg}</span>
        </div>
      )}

      {/* Left Sidebar: Dark Gray Background */}
      <div className="w-64 bg-[#393E46] border-r border-[#222831] flex flex-col p-4 shadow-xl z-20">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#222831]">
            <TriNetraLogo className="w-8 h-8 text-[#00FFF5]" />
            <h1 className="text-xl font-bold tracking-wider text-[#00FFF5]">TriNetra</h1>
        </div>
        
        {/* Upload Button: Teal */}
        <button 
          onClick={() => setShowUpload(true)}
          className="flex items-center justify-center w-full bg-[#00ADB5] hover:bg-[#00FFF5] text-[#222831] font-bold py-2.5 rounded-lg text-xs uppercase mb-3 transition-colors shadow-md"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload FIR
        </button>

        <div className="flex flex-col gap-2 mt-2 mb-2">
            {/* Clear Buttons: Hollow Teal outline */}
            <button 
                onClick={handleClearWorkspace}
                className="w-full bg-[#222831] hover:bg-[#222831] text-[#00ADB5] hover:text-[#00FFF5] border border-[#00ADB5] hover:border-[#00FFF5] font-semibold py-2 rounded text-xs transition-colors"
            >
                Clear View
            </button>
            <button 
                onClick={handleWipeDatabase}
                className="w-full bg-red-900/50 hover:bg-red-600 text-[#EEEEEE] hover:text-white border border-red-800 font-semibold py-2 rounded text-xs transition-colors"
            >
                ⚠️ Nuke Graph Database
            </button>
        </div>

        <div className="text-xs uppercase text-[#00ADB5] font-bold tracking-widest mt-4">Database</div>
        <div className="flex-grow overflow-y-auto flex flex-col gap-1 max-h-[calc(100vh-200px)]">
          {firs.map(firId => (
            <div key={firId} className="flex justify-between items-center group gap-2">
              <button
                onClick={() => loadFir(firId)}
                className="flex-grow text-left font-mono text-xs text-[#00ADB5] hover:text-[#00FFF5] bg-[#222831]/60 hover:bg-[#00ADB5]/20 border border-[#00ADB5]/20 hover:border-[#00FFF5]/50 rounded px-2.5 py-2 transition-all truncate"
                title={firId}
              >
                📁 {firId.slice(0, 8)}...{firId.slice(-4)}
              </button>
              <button onClick={() => deleteFir(firId)} className="text-[#00ADB5] opacity-0 group-hover:opacity-100 hover:text-red-400 transition-colors p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {firs.length === 0 && <p className="text-[#00ADB5]/70 text-xs italic">No cases in memory.</p>}
        </div>
      </div>

      {/* Primary Viewport */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Navbar */}
        <div className="bg-[#222831] border-b border-[#393E46] p-4 flex justify-between items-center z-10 h-[60px] flex-shrink-0 shadow-md">
          <div className="flex bg-[#222831] border border-[#393E46] p-2 rounded w-96 focus-within:border-[#00FFF5] transition-colors">
            <Search className="w-5 h-5 text-[#00ADB5] mr-2" />
            <input 
              className="bg-transparent outline-none flex-grow text-sm text-[#EEEEEE] placeholder-[#00ADB5]"
              placeholder="Search suspect UUID or FIR..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Split Screen UI & Graph */}
        {rawText ? (
          <div className="flex-grow flex flex-col h-[calc(100vh-60px)]">
            {/* Top Half: Text and Extraction */}
            {!isGraphExpanded && (
            <div className="flex-1 flex overflow-hidden border-b border-[#393E46]">
              {/* Raw Text Column: Slate bg */}
              <div className="w-1/2 p-4 flex flex-col border-r border-[#393E46] bg-[#222831]">
                <span className="text-xs font-bold uppercase text-[#00ADB5] mb-2">Raw Case Ingestion</span>
                <div className="bg-[#222831] border border-[#393E46] rounded-lg p-4 flex-1 text-sm text-[#EEEEEE] font-mono shadow-inner overflow-y-auto">
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {rawText}
                  </pre>
                </div>
              </div>

              {/* HITL Form Column: Dark Gray bg */}
              <div className="w-1/2 p-4 flex flex-col bg-[#393E46] overflow-y-auto">
                <span className="text-xs font-bold uppercase text-[#00FFF5] mb-2">Validation</span>
                
                <div className="mb-4 bg-[#393E46] border border-[#00ADB5]/50 p-3 rounded-lg shadow-sm">
                  <h3 className="font-semibold mb-2 text-[#00FFF5] text-xs uppercase">Case Summary</h3>
                  <textarea 
                    className="w-full bg-[#222831] border border-[#00ADB5]/50 rounded px-3 py-1.5 text-sm text-[#EEEEEE] focus:border-[#00FFF5] focus:outline-none h-20 transition-colors"
                    value={formData.case_summary}
                    onChange={(e) => handleFieldChange('case_summary', null, e.target.value)}
                  />
                </div>

                {renderArrayField('Identified Suspects', 'identified_suspects')}
                {renderArrayField('Identified Plaintiffs', 'identified_plaintiffs')}
                {renderArrayField('Phone Anchors', 'phone_anchors')}
                {renderArrayField('Financial/IFSC Anchors', 'financial_anchors')}
                {renderArrayField('Vehicle Anchors', 'vehicle_anchors')}

                <button 
                  onClick={commitFir}
                  className="w-full mt-auto bg-[#00ADB5] hover:bg-[#00FFF5] text-[#222831] font-bold py-3 rounded-lg uppercase tracking-wider text-xs shadow-md transition-colors"
                >
                  Commit Verified Data
                </button>
              </div>
            </div>
            )}

            {/* Bottom Half: NetworkX Analytics Graph */}
            <div className={`${isGraphExpanded ? 'h-full' : 'h-1/2 flex-shrink-0'} relative bg-[#222831]`}>
              {graphData ? (
                <>
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                    <h3 className="font-bold text-sm bg-[#393E46] text-[#00FFF5] p-2 rounded border border-[#00ADB5]/50 shadow">NetworkX Connectivity View</h3>
                    <button 
                      onClick={() => setIsGraphExpanded(!isGraphExpanded)}
                      className="bg-[#393E46] text-[#00ADB5] p-2 rounded border border-[#00ADB5]/50 shadow hover:bg-[#00ADB5] hover:text-[#222831] transition-colors flex items-center justify-center"
                      title={isGraphExpanded ? "Restore View" : "Expand Graph"}
                    >
                      {isGraphExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <NetworkGraph data={graphData} onNodeClick={(node) => {
                    // Logic to jump to connected FIRs
                  }} />
                  <div className="absolute bottom-4 left-4 z-30 bg-[#222831]/90 text-[#EEEEEE] border border-[#00ADB5]/50 p-3 text-xs rounded shadow-lg backdrop-blur">
                    <div className="font-bold mb-2 border-b border-[#00ADB5]/50 pb-1 text-[#00FFF5] uppercase tracking-widest">Analytics Legend</div>
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-500"></div><span className="text-sm text-[#EEEEEE]">Suspect / Person</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500"></div><span className="text-sm text-[#EEEEEE]">Phone Anchor</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_red]"></div><span className="text-sm text-[#EEEEEE]">Nexus (Centrality &gt; 0.4)</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-[#00ADB5]/50 font-semibold tracking-widest uppercase text-sm">
                  Waiting for Neo4j Commit...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center text-[#00ADB5]/50 font-semibold tracking-widest uppercase">
            System Idle. Upload source material to begin.
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="absolute inset-0 bg-[#222831]/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#393E46] border border-[#00ADB5]/50 p-6 rounded-xl shadow-[0_0_30px_rgba(0,173,181,0.2)] w-96 transform transition-all">
            <h2 className="text-xl font-bold mb-4 text-[#00FFF5] uppercase tracking-wider text-center">Upload Intelligence (txt)</h2>
            <input 
              type="file" 
              accept=".txt" 
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="mb-6 block w-full text-sm text-[#EEEEEE]
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-bold file:uppercase file:tracking-wider
                file:bg-[#00ADB5] file:text-[#222831]
                hover:file:bg-[#00FFF5] cursor-pointer transition-colors"
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 border border-[#00ADB5]/50 rounded text-[#00ADB5] hover:bg-[#00ADB5] hover:text-[#222831] transition-colors font-semibold uppercase text-xs tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleUploadClick}
                className="px-4 py-2 bg-[#00ADB5] hover:bg-[#00FFF5] text-[#222831] rounded font-bold transition-colors shadow-lg uppercase text-xs tracking-wider"
              >
                Launch NLP Engine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
