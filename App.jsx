import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore'; // Import Firestore functions

// Added new icons for UI/UX features
import { Home, Users, FileText, DollarSign, Settings, TrendingUp, Briefcase, MessageSquare, Plus, CreditCard, Layers, ArrowLeft, Calculator, LogOut, Loader, Calendar as CalendarIcon, User, Lock, Save, ClipboardList, Send, ThumbsUp, ThumbsDown, Download, Video, Workflow, BriefcaseBusiness, Search, Sun, Moon, Info, CheckCircle, XCircle, Share2, Award, ClipboardCheck, Zap, Server, BrainCircuit } from 'lucide-react'; // Added BrainCircuit for AI
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- Theme Context ---
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Initialize theme from localStorage or default to 'dark'
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    // Apply theme classes to the document body
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// --- Notification Context ---
const NotificationContext = createContext();

const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null); // { message, type: 'success' | 'error' | 'info' }
  const notificationTimeoutRef = useRef(null);

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, duration);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <div
          role="alert"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-3 text-white transition-all duration-300 ease-out transform ${
            notification.type === 'success' ? 'bg-green-600' :
            notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}
        >
          {notification.type === 'success' && <CheckCircle size={20} />}
          {notification.type === 'error' && <XCircle size={20} />}
          {notification.type === 'info' && <Info size={20} />}
          <span>{notification.message}</span>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

const useNotification = () => useContext(NotificationContext);


// Helper to format Indian Rupee (INR)
const formatINR = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Reusable Card Component
const Card = ({ title, value, icon: Icon, colorClass = 'text-blue-400' }) => {
  const { theme } = useTheme();
  return (
    <div className={`p-6 rounded-lg shadow-md flex items-center space-x-4 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
      <div className={`p-3 rounded-full bg-opacity-20 ${colorClass.replace('text-', 'bg-')}`}>
        <Icon size={24} className={colorClass} />
      </div>
      <div>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{title}</p>
        <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{value}</p>
      </div>
    </div>
  );
};

// Navigation Item Component
const NavItem = ({ icon: Icon, text, isActive, onClick }) => {
  const { theme } = useTheme();
  return (
    <button
      className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
        isActive
          ? `${theme === 'dark' ? 'bg-zinc-700 text-white shadow-md' : 'bg-blue-100 text-blue-700'}`
          : `${theme === 'dark' ? 'text-gray-300 hover:bg-zinc-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-700'}`
      }`}
      onClick={onClick}
      aria-label={text}
    >
      <Icon size={20} />
      <span className="font-medium text-xs md:text-sm">{text}</span>
    </button>
  );
};

// Candidate Detail View Component
const CandidateDetailView = ({ candidate, onBack, onUpdateCandidateStage }) => {
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const [currentStage, setCurrentStage] = useState(candidate.stage);
  const [internalNotes, setInternalNotes] = useState(candidate.internalNotes || '');
  const [offerLetterStatus, setOfferLetterStatus] = useState('Not Generated');
  const [backgroundCheckStatus, setBackgroundCheckStatus] = useState('Not Started');
  const [assessmentStatus, setAssessmentStatus] = useState('Pending');
  const [generatedQuestions, setGeneratedQuestions] = useState(null); // State for generated questions
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false); // Loading state for LLM call


  const handleStageChange = async (e) => {
    const newStage = e.target.value;
    setCurrentStage(newStage);
    await onUpdateCandidateStage(candidate.id, newStage);
    showNotification(`Candidate stage updated to: ${newStage}`, 'success');
  };

  const handleSaveNotes = () => {
    // In a real app, this would save to a database. For this example, it's just a notification.
    showNotification('Notes saved!', 'success');
  };

  const handleGenerateOfferLetter = () => {
    // Offer letter generation
    setOfferLetterStatus('Generated and Sent');
    showNotification(`Offer letter for ${candidate.name} generated and sent.`, 'success');
  };

  const handleInitiateBackgroundCheck = () => {
    setBackgroundCheckStatus('Initiated');
    showNotification('Background check initiated!', 'info');
  };

  const handleSendAssessment = () => {
    setAssessmentStatus('Sent');
    showNotification('Assessment sent to candidate!', 'info');
  };

  // Function to call Gemini API for interview question generation
  const generateInterviewQuestions = async () => {
    setIsGeneratingQuestions(true);
    setGeneratedQuestions(null); // Clear previous questions

    const prompt = `Generate 5-7 interview questions for a candidate applying for the role of "${candidate.jobAppliedFor}".
    The candidate has the following highlights from their resume:
    Education: ${candidate.resumeHighlights?.education || 'N/A'}
    Experience: ${candidate.resumeHighlights?.experience || 'N/A'}
    Skills: ${(candidate.resumeHighlights?.skills || []).join(', ') || 'N/A'}

    Focus on questions that assess both technical skills and behavioral aspects relevant to the role and their experience.
    Format the output as a numbered list of questions.`;

    try {
      const chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = ""; // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setGeneratedQuestions(text);
        showNotification('Interview questions generated!', 'success');
      } else {
        setGeneratedQuestions("Failed to generate questions. Please try again.");
        showNotification('Failed to generate questions.', 'error');
      }
    } catch (error) {
      console.error("Error generating interview questions:", error);
      setGeneratedQuestions("Error generating questions. Please check console for details.");
      showNotification('Error generating questions. Network or API issue.', 'error');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };


  const allStages = ['Resume Reviewed', 'Screening', 'Assessment Taken', 'Interview - R1', 'Interview - R2', 'Offer Extended', 'Offer Accepted', 'On Hold', 'Offer Rejected'];

  return (
    <div>
      <button onClick={onBack} className={`flex items-center text-sm mb-6 transition-colors duration-200 ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`} aria-label="Back to Candidates">
        <ArrowLeft size={16} className="mr-2" /> Back to Candidates
      </button>

      <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{candidate.name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Candidate Information</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Job Applied For:</span> {candidate.jobAppliedFor}</p>
          <div className="flex items-center mb-2">
            <span className={`font-medium text-sm mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Current Stage:</span>
            <select
              value={currentStage}
              onChange={handleStageChange}
              className={`p-1 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
              aria-label="Candidate Stage"
            >
              {allStages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>AI Match Score:</span> <span className="font-bold text-blue-400">{candidate.matchScore}%</span></p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Last Contact:</span> {candidate.lastContact}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Email:</span> {candidate.email || 'N/A'}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Phone:</span> {candidate.phone || 'N/A'}</p>
        </div>

        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Indian System Specifics</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Aadhaar No.:</span> {candidate.aadhaarNumber || 'N/A'}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>PAN No.:</span> {candidate.panNumber || 'N/A'}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Current CTC:</span> {formatINR(candidate.currentCTC)}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Expected CTC:</span> {formatINR(candidate.expectedCTC)}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Notice Period:</span> {candidate.noticePeriod || 'N/A'}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Willing to Relocate:</span> {candidate.willingToRelocate || 'N/A'}</p>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Languages:</span> ${(candidate.languages || []).join(', ') || 'N/A'}</p>
          <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>This section includes other Indian KYC/compliance details.</p>
        </div>
      </div>

      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Resume Highlights (AI Extracted) & Skill Graph</h3>
        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Education:</span> {candidate.resumeHighlights?.education || 'N/A'}</p>
        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Experience:</span> {candidate.resumeHighlights?.experience || 'N/A'}</p>
        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}><span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Skills:</span> ${(candidate.resumeHighlights?.skills || []).join(', ') || 'N/A'}</p>
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>This section leverages AI to parse and highlight key resume information for quick review and AI-powered candidate matching based on a comprehensive skill graph for more accurate matching and identifying adjacent skills.</p>
      </div>

      {/* Integrated Video Pitches/Introduction */}
      {candidate.videoPitchUrl && (
        <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><Video size={20} /> Candidate Video Pitch</h3>
          <div className="relative w-full aspect-video bg-zinc-700 rounded-md overflow-hidden flex items-center justify-center">
            <img src={candidate.videoPitchUrl} alt="Video Pitch Placeholder" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-lg font-semibold">
              <span className="p-3 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700 transition-colors duration-200" role="button" aria-label="Play video pitch">▶️ Play Video</span>
            </div>
          </div>
          <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Candidates can record short video introductions directly through the ATS portal, providing a quick insight into their communication style and personality early in the process.</p>
        </div>
      )}

      {/* Assessments & Background Screening */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><Award size={20} /> Assessments</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Current Status: <span className="font-semibold text-blue-400">{assessmentStatus}</span></p>
          <button onClick={handleSendAssessment} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95" aria-label="Send Assessment">
            <Send size={16} /> <span>Send Assessment</span>
          </button>
          <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Integrate with leading assessment platforms for skills, psychometric, and coding tests. Results are automatically tracked here.</p>
        </div>

        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><ClipboardCheck size={20} /> Background Screening</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Current Status: <span className="font-semibold text-blue-400">{backgroundCheckStatus}</span></p>
          <button onClick={handleInitiateBackgroundCheck} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95" aria-label="Initiate Background Check">
            <Zap size={16} /> <span>Initiate Background Check</span>
          </button>
          <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Seamlessly integrate with background verification services for quick and compliant checks.</p>
        </div>
      </div>


      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Detailed Compensation Breakdown (Offer)</h3>
        <table className="min-w-full divide-y divide-zinc-700">
          <thead className={theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Component</th>
              <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Amount/Details</th>
            </tr>
          </thead>
          <tbody className={theme === 'dark' ? 'bg-zinc-800 divide-y divide-zinc-700' : 'bg-white divide-y divide-gray-200'}>
            <tr>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Base Salary</td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatINR(candidate.compensation?.baseSalary)}</td>
            </tr>
            <tr>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Annual Bonus</td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatINR(candidate.compensation?.annualBonus)}</td>
            </tr>
            <tr>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Equity / Stock</td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.compensation?.equity || 'N/A'}</td>
            </tr>
            <tr>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Benefits</td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.compensation?.benefits || 'N/A'}</td>
            </tr>
            <tr>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Allowances</td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.compensation?.allowances || 'N/A'}</td>
            </tr>
            <tr className={`font-bold ${theme === 'dark' ? 'bg-zinc-700 text-white' : 'bg-gray-200 text-zinc-900'}`}>
              <td className="px-6 py-4 whitespace-nowrap text-sm">Total Compensation (Estimated)</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatINR(candidate.compensation?.totalCompensation)}</td>
            </tr>
          </tbody>
        </table>
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Compensation details are precise, compliant, and integrated with offer management.</p>
      </div>

      {/* Interview Feedback/Scorecards */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><ClipboardList size={20} /> Interview Feedback & Assessments</h3>
        {candidate.interviewFeedback && candidate.interviewFeedback.length > 0 ? (
          <div className="space-y-4">
            {candidate.interviewFeedback.map((feedback, index) => (
              <div key={index} className={`${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'} p-4 rounded-lg`}>
                <p className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Round: {feedback.round} (${feedback.date})</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Interviewer: {feedback.interviewer}</p>
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Score: <span className="font-semibold text-blue-400">{feedback.score}/10</span></p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Comments: {feedback.comments}</p>
              </div>
            ))}
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Customizable digital scorecards promote objective evaluations. AI-powered bias detection flags inconsistent or biased language in feedback, helping mitigate unconscious bias.</p>
          </div>
        ) : (
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No interview feedback recorded yet.</p>
        )}
      </div>

      {/* Internal Notes */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><MessageSquare size={20} /> Internal Notes</h3>
        <textarea
          className={`w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 min-h-[100px] transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
          placeholder="Add internal notes about this candidate..."
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          aria-label="Internal notes"
        ></textarea>
        <button onClick={handleSaveNotes} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95" aria-label="Save notes">
          <Save size={16} /> <span>Save Notes</span>
        </button>
      </div>

      {/* Communication Log */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><Send size={20} /> Communication Log</h3>
        {candidate.communications && candidate.communications.length > 0 ? (
          <ul className="space-y-3">
            {candidate.communications.map((comm, index) => (
              <li key={index} className={`${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'} p-3 rounded-lg text-sm`}>
                <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{comm.subject}</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{comm.type} - {comm.time} on ${comm.date}</p>
                <p className={`mt-1 italic ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>"{comm.snippet}..."</p>
              </li>
            ))}
            <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Integrated email & SMS tools, supported by an AI Recruiter Co-pilot, automatically log full conversations here and assist with drafting personalized outreach.</p>
          </ul>
        ) : (
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No communications recorded yet.</p>
        )}
      </div>

      {/* Offer Letter Management */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><DollarSign size={20} /> Offer Letter Management</h3>
        <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Current Status: <span className="font-semibold text-blue-400">{offerLetterStatus}</span></p>
        <button
          onClick={handleGenerateOfferLetter}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95"
          aria-label="Generate and send offer letter"
        >
          <FileText size={16} /> <span>Generate & Send Offer Letter</span>
        </button>
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>This feature generates a customizable offer letter, integrates with e-signature, and tracks acceptance status, streamlining the offer process.</p>
      </div>

      {/* AI Interview Question Generator */}
      <div className={`p-6 rounded-lg shadow-md mb-6 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><BrainCircuit size={20} /> AI Interview Questions ✨</h3>
        <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Generate tailored interview questions for this candidate based on their profile.</p>
        <button
          onClick={generateInterviewQuestions}
          disabled={isGeneratingQuestions}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95"
          aria-label="Generate Interview Questions"
        >
          {isGeneratingQuestions ? (
            <>
              <Loader size={16} className="animate-spin" /> <span>Generating...</span>
            </>
          ) : (
            <>
              <BrainCircuit size={16} /> <span>Generate Questions</span>
            </>
          )}
        </button>
        {generatedQuestions && (
          <div className={`mt-4 p-4 rounded-md ${theme === 'dark' ? 'bg-zinc-700 text-gray-200' : 'bg-blue-50 text-zinc-900'}`}>
            <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-blue-700'}`}>Generated Questions:</h4>
            <pre className="whitespace-pre-wrap text-sm">{generatedQuestions}</pre>
          </div>
        )}
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Leverages Gemini API to provide relevant and specific interview questions, saving preparation time.</p>
      </div>


      <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Other Details</h3>
        <ul className={`list-disc list-inside space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          <li>Automated Interview Scheduler for intelligent conflict resolution and backup suggestions.</li>
          <li>Candidate Document Management for resumes and certificates.</li>
          <li>Detailed Activity Timeline for comprehensive tracking.</li>
        </ul>
      </div>
    </div>
  );
};

// CTC & Tax Calculator Component
const CTCTaxCalculator = () => {
  const { theme } = useTheme();
  const [basicSalary, setBasicSalary] = useState(750000);
  const [hra, setHra] = useState(150000);
  const [otherAllowances, setOtherAllowances] = useState(100000);
  const [performanceBonus, setPerformanceBonus] = useState(250000);
  const [employerPF, setEmployerPF] = useState(180000);
  const [gratuity, setGratuity] = useState(50000);
  const [medicalInsuranceEmployer, setMedicalInsuranceEmployer] = useState(20000);
  const [employerNPS, setEmployerNPS] = useState(0);

  const [annualCTC, setAnnualCTC] = useState(0);
  const [grossSalary, setGrossSalary] = useState(0);
  const [taxableIncome, setTaxableIncome] = useState(0);
  const [totalTaxLiability, setTotalTaxLiability] = useState(0);
  const [monthlyTDS, setMonthlyTDS] = useState(0);
  const [netSalary, setNetSalary] = useState(0);

  useEffect(() => {
    calculateCTCAndTax();
  }, [basicSalary, hra, otherAllowances, performanceBonus, employerPF, gratuity, medicalInsuranceEmployer, employerNPS]);

  const calculateCTCAndTax = () => {
    // 1. Calculate Annual CTC
    const calculatedCTC =
      basicSalary +
      hra +
      otherAllowances +
      performanceBonus +
      employerPF +
      gratuity +
      medicalInsuranceEmployer +
      employerNPS;
    setAnnualCTC(calculatedCTC);

    // 2. Calculate Gross Salary (for tax calculation)
    const calculatedGrossSalary = basicSalary + hra + otherAllowances + performanceBonus;
    setGrossSalary(calculatedGrossSalary);

    // 3. Calculate Taxable Income (New Tax Regime FY 2025-26)
    let currentTaxableIncome = calculatedGrossSalary;

    // Deduct Standard Deduction (New Regime)
    currentTaxableIncome = Math.max(0, currentTaxableIncome - 75000);

    // Deduct Employer's NPS Contribution (Section 80CCD(2))
    const maxEmployerNPSDed = basicSalary * 0.10;
    const actualEmployerNPSDed = Math.min(employerNPS, maxEmployerNPSDed);
    currentTaxableIncome = Math.max(0, currentTaxableIncome - actualEmployerNPSDed);

    setTaxableIncome(currentTaxableIncome);

    // 4. Calculate Income Tax Liability (New Tax Regime FY 2025-26)
    let tax = 0;
    const slabs = [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 },
    ];

    let remainingTaxableIncome = currentTaxableIncome;

    for (let i = 0; i < slabs.length; i++) {
      const currentSlabLimit = slabs[i].limit;
      const prevSlabLimit = i === 0 ? 0 : slabs[i-1].limit;
      const slabSegmentAmount = currentSlabLimit - prevSlabLimit;

      if (remainingTaxableIncome > 0) {
        const taxableInCurrentSlab = Math.min(remainingTaxableIncome, slabSegmentAmount);
        tax += taxableInCurrentSlab * slabs[i].rate;
        remainingTaxableIncome -= taxableInCurrentSlab;
      } else {
        break;
      }
    }

    // Apply Section 87A Rebate (Full rebate for taxable income up to ₹12,00,000)
    if (currentTaxableIncome <= 1200000) {
      tax = 0;
    }

    // Add Health & Education Cess (4%)
    tax += tax * 0.04;

    setTotalTaxLiability(tax);

    // 5. Calculate Monthly TDS
    setMonthlyTDS(tax / 12);

    // 6. Calculate Net Salary (Take-Home Pay)
    const employeePFContribution = basicSalary * 0.12; // Assuming employee PF is 12% of basic salary
    const professionalTax = 2400; // Annual, fixed for simplicity, actual varies by state

    const calculatedNetSalary = calculatedGrossSalary - employeePFContribution - professionalTax - tax;
    setNetSalary(calculatedNetSalary);
  };

  const handleChange = (e, setter) => {
    setter(Number(e.target.value));
  };

  return (
    <div>
      <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>CTC & Tax Calculator (FY 2025-26 New Regime)</h2>
      <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
        <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Enter your annual salary components to get an estimated CTC, Taxable Income, and TDS.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="basicSalary" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Basic Salary (INR)</label>
            <input type="number" id="basicSalary" value={basicSalary} onChange={(e) => handleChange(e, setBasicSalary)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="hra" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>HRA (INR)</label>
            <input type="number" id="hra" value={hra} onChange={(e) => handleChange(e, setHra)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="otherAllowances" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Other Allowances (INR)</label>
            <input type="number" id="otherAllowances" value={otherAllowances} onChange={(e) => handleChange(e, setOtherAllowances)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="performanceBonus" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Performance Bonus (INR)</label>
            <input type="number" id="performanceBonus" value={performanceBonus} onChange={(e) => handleChange(e, setPerformanceBonus)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="employerPF" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Employer's PF Contribution (INR)</label>
            <input type="number" id="employerPF" value={employerPF} onChange={(e) => handleChange(e, setEmployerPF)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="gratuity" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Gratuity (INR)</label>
            <input type="number" id="gratuity" value={gratuity} onChange={(e) => handleChange(e, setGratuity)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="medicalInsuranceEmployer" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Medical Insurance (Employer Paid) (INR)</label>
            <input type="number" id="medicalInsuranceEmployer" value={medicalInsuranceEmployer} onChange={(e) => handleChange(e, setMedicalInsuranceEmployer)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
          <div>
            <label htmlFor="employerNPS" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Employer's NPS Contribution (INR)</label>
            <input type="number" id="employerNPS" value={employerNPS} onChange={(e) => handleChange(e, setEmployerNPS)}
              className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} />
          </div>
        </div>

        <h3 className={`text-lg font-semibold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Calculation Results</h3>
        <table className="min-w-full divide-y divide-zinc-700">
          <tbody className={theme === 'dark' ? 'bg-zinc-800 divide-y divide-zinc-700' : 'bg-white divide-y divide-gray-200'}>
            <tr>
              <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Annual CTC</td>
              <td className={`px-6 py-3 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatINR(annualCTC)}</td>
            </tr>
            <tr>
              <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Gross Salary</td>
              <td className={`px-6 py-3 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatINR(grossSalary)}</td>
            </tr>
            <tr>
              <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Taxable Income (New Regime)</td>
              <td className={`px-6 py-3 whitespace-nowrap text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatINR(taxableIncome)}</td>
            </tr>
            <tr className="font-bold">
              <td className={`px-6 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Total Annual Tax Liability</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-red-400 text-right">{formatINR(totalTaxLiability)}</td>
            </tr>
            <tr className="font-bold">
              <td className={`px-6 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Monthly TDS</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-red-400 text-right">{formatINR(monthlyTDS)}</td>
            </tr>
            <tr className={`font-bold ${theme === 'dark' ? 'bg-zinc-700 text-white' : 'bg-gray-200 text-zinc-900'}`}>
              <td className="px-6 py-3 whitespace-nowrap text-sm">Estimated Annual Net Salary (Take-Home)</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-green-400 text-right">{formatINR(netSalary)}</td>
            </tr>
          </tbody>
        </table>
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>This is a simplified calculation using the New Tax Regime (FY 2025-26). It assumes standard deductions and does not account for all possible exemptions, investments, or variable components. For precise tax planning, consult a financial advisor.</p>
      </div>
    </div>
  );
};

// Calendar View Component
const CalendarView = ({ events }) => {
  const { theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(date);
  };

  const eventsForSelectedDate = selectedDate
    ? events.filter(event => event.date === selectedDate.toISOString().split('T')[0])
    : [];

  const getEventsForDay = (day) => {
    const dateString = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return events.filter(event => event.date === dateString);
  };

  const daysArray = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysArray.push(null); // Empty cells for days before the 1st
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  return (
    <div>
      <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Task & Schedule Calendar</h2>
      <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
        <div className="flex justify-between items-center mb-6">
          <button onClick={goToPreviousMonth} className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors duration-200" aria-label="Previous month">
            Prev
          </button>
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{monthName}</h3>
          <button onClick={goToNextMonth} className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors duration-200" aria-label="Next month">
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-sm mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="font-bold text-blue-400">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daysArray.map((day, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg aspect-square flex flex-col items-center justify-start text-xs transition-colors duration-200 ${
                day ? `${theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer` : `${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`
              } ${
                selectedDate && day && selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth.getMonth()
                  ? 'border-2 border-blue-500' : ''
              }`}
              onClick={() => day && handleDateClick(day)}
              role="gridcell"
              aria-label={day ? `${day} ${monthName}` : 'Empty day'}
            >
              {day && <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{day}</span>}
              {day && getEventsForDay(day).length > 0 && (
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1 animate-pulse"></div>
              )}
            </div>
          ))}
        </div>

        {selectedDate && (
          <div className="mt-8">
            <h3 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Events for ${selectedDate.toLocaleDateString()}</h3>
            {eventsForSelectedDate.length > 0 ? (
              <ul className="space-y-2">
                {eventsForSelectedDate.map(event => (
                  <li key={event.id} className={`${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'} p-3 rounded-lg flex justify-between items-center text-sm`}>
                    <div>
                      <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{event.description}</p>
                      <p className={`text-gray-400 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{event.type} - {event.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No events scheduled for this date.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


// HRIS Page Component (New!)
const HRISPage = ({ employees }) => {
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const departments = ['All', ...new Set(employees.map(emp => emp.department))].sort();
  const statuses = ['All', ...new Set(employees.map(emp => emp.status))].sort();

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'All' || employee.department === filterDepartment;
    const matchesStatus = filterStatus === 'All' || employee.status === filterStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleDownloadEmployeeData = () => {
    const headers = [
      "ID", "Name", "Department", "Job Title", "Email", "Phone", "Status",
      "Hire Date", "Annual CTC", "Location", "Gender", "Date of Birth",
      "Address", "Emergency Contact Name", "Emergency Contact Phone", "Emergency Contact Relationship",
      "Bank Details", "Health Insurance", "Provident Fund", "Gratuity", "NPS",
      "Sick Leave Balance", "Casual Leave Balance", "Earned Leave Balance", "Performance Review Summary"
    ];

    const csvRows = filteredEmployees.map(e => {
      const row = [
        e.id, e.name, e.department, e.jobTitle, e.email, e.phone, e.status,
        e.hireDate, e.annualCTC, e.location, e.gender, e.dob,
        e.address, e.emergencyContact?.name, e.emergencyContact?.phone, e.emergencyContact?.relationship,
        e.bankDetails, e.benefitsEnrollment?.healthInsurance ? 'Yes' : 'No',
        e.benefitsEnrollment?.providentFund ? 'Yes' : 'No',
        e.benefitsEnrollment?.gratuity ? 'Yes' : 'No',
        e.benefitsEnrollment?.nps ? 'Yes' : 'No',
        e.leaveBalance?.sick, e.leaveBalance?.casual, e.leaveBalance?.earned, e.performanceReviewSummary
      ];
      return row.map(item => {
        if (typeof item === 'string' && item.includes(',')) {
          return `"${item.replace(/"/g, '""')}"`;
        }
        return item;
      }).join(',');
    });

    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'sapphire_hr_employee_data.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Employee data downloaded successfully!', 'success');
    }
  };


  return (
    <div>
      <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>HRIS: Employee Management</h2>
      <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
        <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          The Human Resources Information System (HRIS) module provides a centralized platform for managing all employee-related data,
          from personal information and contact details to compensation, benefits, and performance records.
          This ensures data accuracy, simplifies HR processes, and supports strategic workforce planning.
        </p>

        {/* Employee Directory */}
        <h3 className={`text-lg font-semibold mb-3 mt-6 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Employee Directory</h3>
        <div className="flex flex-wrap gap-4 mb-4">
          <input
            type="text"
            placeholder="Search employees by name, title, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`flex-1 min-w-[200px] p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
            aria-label="Search employees"
          />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className={`p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
            aria-label="Filter by Department"
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
            aria-label="Filter by Status"
          >
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            onClick={handleDownloadEmployeeData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95"
            aria-label="Download Employee Data"
          >
            <Download size={16} /> <span>Download Data (CSV)</span>
          </button>
        </div>

        <div className={`overflow-x-auto rounded-lg shadow-inner ${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'}`}>
          <table className="min-w-full divide-y divide-zinc-600">
            <thead className={theme === 'dark' ? 'bg-zinc-600' : 'bg-gray-200'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Employee ID</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Name</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Department</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Job Title</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Hire Date</th>
              </tr>
            </thead>
            <tbody className={theme === 'dark' ? 'bg-zinc-800 divide-y divide-zinc-700' : 'bg-white divide-y divide-gray-200'}>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(employee => (
                  <tr key={employee.id} className={`${theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'}`}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>{employee.id}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{employee.name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{employee.department}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{employee.jobTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.status === 'Active' ? 'bg-green-600/20 text-green-300' :
                        employee.status === 'On Leave' ? 'bg-orange-600/20 text-orange-300' :
                        'bg-red-600/20 text-red-300'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{employee.hireDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className={`px-6 py-4 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No employees found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Click on an employee row to view their detailed profile with more HRIS data.</p>


        {/* Benefits Management */}
        <h3 className={`text-lg font-semibold mb-3 mt-8 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Benefits Management</h3>
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-gray-100 border-gray-200'} text-sm`}>
          <p className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Manage health insurance, retirement plans (PF, NPS, Gratuity), and other employee perks.
          </p>
          <ul className={`list-disc list-inside space-y-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Health & Wellness Programs</li>
            <li>Retirement Savings (Provident Fund, NPS)</li>
            <li>Group Term Life and Accident Insurance</li>
            <li>Leave Encashment and Gratuity Calculations</li>
          </ul>
          <button onClick={() => showNotification('Benefit enrollment process initiated!', 'info')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Manage Benefits">
            Manage Benefits
          </button>
        </div>

        {/* Time & Attendance */}
        <h3 className={`text-lg font-semibold mb-3 mt-8 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Time & Attendance</h3>
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-gray-100 border-gray-200'} text-sm`}>
          <p className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Track employee work hours, manage leave requests, and monitor attendance.
          </p>
          <ul className={`list-disc list-inside space-y-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Automated Clock-in/out & Timesheet Management</li>
            <li>Leave Application & Approval Workflows</li>
            <li>Attendance Reports & Compliance</li>
          </ul>
          <button onClick={() => showNotification('Time & Attendance reporting generated!', 'info')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="View Attendance">
            View Attendance
          </button>
        </div>

        {/* Performance Management */}
        <h3 className={`text-lg font-semibold mb-3 mt-8 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Performance Management</h3>
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-gray-100 border-gray-200'} text-sm`}>
          <p className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Oversee employee performance reviews, set goals, and track development plans.
          </p>
          <ul className={`list-disc list-inside space-y-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Goal Setting & Tracking (OKR/KRA support)</li>
            <li>360-Degree Feedback & Annual Reviews</li>
            <li>Performance Improvement Plans (PIPs)</li>
            <li>Learning & Development Integration</li>
          </ul>
          <button onClick={() => showNotification('Performance review cycle started!', 'info')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Start Performance Review">
            Start Review Cycle
          </button>
        </div>

      </div>
    </div>
  );
};


// Settings Page Component
const SettingsPage = ({ userDisplayName, userRole, onUpdateUserName, onUpdateUserPassword, handleLogout }) => {
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const [newUserName, setNewUserName] = useState(userDisplayName);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameMessage, setNameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (newUserName.trim() !== '') {
      onUpdateUserName(newUserName);
      showNotification('Name updated successfully!', 'success');
      setNameMessage('');
    } else {
      showNotification('Name cannot be empty.', 'error');
      setNameMessage('Name cannot be empty.');
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (oldPassword === 'admin' && newPassword.length >= 6 && newPassword === confirmPassword) {
      onUpdateUserPassword(newPassword);
      showNotification('Password updated successfully!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('');
    } else {
      showNotification('Password update failed. Please check criteria.', 'error');
      setPasswordMessage('Please check old password, new password length (min 6), and confirmation.');
    }
  };

  return (
    <div>
      <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Settings & Admin</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Details */}
        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><User size={20} /> User Details</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Current Role:</span> <span className="font-bold text-blue-400">{userRole}</span>
          </p>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Update your profile information.</p>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label htmlFor="userName" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Display Name</label>
              <input
                type="text"
                id="userName"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                required
                aria-label="Display Name"
              />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Save Name">
              <Save size={16} /> <span>Save Name</span>
            </button>
            {nameMessage && <p className={`text-sm mt-2 ${nameMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>{nameMessage}</p>}
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} mt-2`}>This updates your user profile.</p>
          </form>
        </div>

        {/* Change Password */}
        <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><Lock size={20} /> Change Password</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Update your account password.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="oldPassword" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Old Password (Default: 'admin')</label>
              <input
                type="password"
                id="oldPassword"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                required
                aria-label="Old Password"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>New Password (Min 6 characters)</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                required
                aria-label="New Password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                required
                aria-label="Confirm New Password"
              />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Change Password">
              <Save size={16} /> <span>Change Password</span>
            </button>
            {passwordMessage && <p className={`text-sm mt-2 ${passwordMessage.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>{passwordMessage}</p>}
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} mt-2`}>This updates your account password.</p>
          </form>
        </div>
      </div>

      {/* Logout Button in Settings */}
      <div className={`p-6 rounded-lg shadow-md mt-6 ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><LogOut size={20} /> Logout</h3>
        <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Sign out from your Sapphire HR account.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95"
          aria-label="Log Out Now"
        >
          <LogOut size={16} /> <span>Log Out Now</span>
        </button>
      </div>

      {/* Other Admin Settings */}
      <div className={`p-6 rounded-lg shadow-md mt-6 ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Other Admin Settings</h3>
        <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Here you can manage:</p>
        <ul className={`list-disc list-inside space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          <li className="text-sm">User, Role, and Access Management with granular controls for data privacy.</li>
          <li className="text-sm">
            **Blueprint (Automation)**: Customize workflows and automate repetitive tasks based on triggers (e.g., auto-send rejection email).
          </li>
          <li className="text-sm">System Integrations for Payroll, Background Checks, HRIS/HRMS, and E-signature platforms.</li>
          <li className="text-sm">Data Export & Compliance Settings including automated audit trails and proactive compliance alerts.</li>
          <li className="text-sm">
            **AI/ML Configuration & Model Tuning**: Fine-tune AI for candidate matching, bias detection, and predictive analytics.
          </li>
          <li className="text-sm">Offer Letter Templates.</li>
          <li className="text-sm">Branded Career Page Customization.</li>
          <li className="text-sm">Customizable Dashboards for different personas like Recruiters, Hiring Managers, and HR Leaders.</li>
        </ul>
      </div>
    </div>
  );
};


// Main layout component
const MainLayout = ({ user, handleLogout, db, auth, appId, userId }) => {
  const { theme, toggleTheme } = useTheme();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // States for Firestore data
  const [candidates, setCandidates] = useState([]);
  const [offers, setOffers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [events, setEvents] = useState([]);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState(user.displayName || user.email || user.uid);
  const [currentUserRole] = useState('Admin/HR User');


  // --- Data Fetching from Firestore ---
  useEffect(() => {
    if (!db || !userId) {
        console.warn("Firestore or User ID not available for data fetching.");
        return;
    }

    // Reference to public collections
    const candidatesColRef = collection(db, `artifacts/${appId}/public/data/candidates`);
    const offersColRef = collection(db, `artifacts/${appId}/public/data/offers`);
    const employeesColRef = collection(db, `artifacts/${appId}/public/data/employees`);
    const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);

    // Fetch Candidates
    const unsubscribeCandidates = onSnapshot(candidatesColRef, (snapshot) => {
      const fetchedCandidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCandidates(fetchedCandidates);
      // If a candidate was selected and updated, ensure the selectedCandidate state also reflects the latest data
      if (selectedCandidate) {
        setSelectedCandidate(fetchedCandidates.find(c => c.id === selectedCandidate.id) || null);
      }
    }, (error) => {
      console.error("Error fetching candidates:", error);
      showNotification("Error loading candidates.", "error");
    });

    // Fetch Offers
    const unsubscribeOffers = onSnapshot(offersColRef, (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching offers:", error);
      showNotification("Error loading offers.", "error");
    });

    // Fetch Employees
    const unsubscribeEmployees = onSnapshot(employeesColRef, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching employees:", error);
      showNotification("Error loading employees.", "error");
    });

    // Fetch Events
    const unsubscribeEvents = onSnapshot(eventsColRef, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching events:", error);
      showNotification("Error loading events.", "error");
    });

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeCandidates();
      unsubscribeOffers();
      unsubscribeEmployees();
      unsubscribeEvents();
    };
  }, [db, appId, userId, selectedCandidate, showNotification]); // Added selectedCandidate to dependencies to update detail view

  // --- Initial Data Population (if collections are empty) ---
  // This useEffect runs once on component mount to add initial dummy data to Firestore
  // if the collections are empty. This ensures a populated UI on first run.
  useEffect(() => {
    if (db && userId) {
      const addInitialData = async () => {
        const candidatesColRef = collection(db, `artifacts/${appId}/public/data/candidates`);
        const offersColRef = collection(db, `artifacts/${appId}/public/data/offers`);
        const employeesColRef = collection(db, `artifacts/${appId}/public/data/employees`);
        const eventsColRef = collection(db, `artifacts/${appId}/public/data/events`);

        // Check if candidates collection is empty and populate if so
        const candidatesDocs = await getDocs(candidatesColRef);
        if (candidatesDocs.empty) {
          const dummyCandidates = generateDummyCandidates(50); // Generate 50 candidates
          dummyCandidates.forEach(async (candidate) => {
            await addDoc(candidatesColRef, { ...candidate, createdBy: userId });
          });
          console.log("Added initial dummy candidates.");
        }

        // Check if offers collection is empty and populate if so
        const offersDocs = await getDocs(offersColRef);
        if (offersDocs.empty) {
          const dummyOffers = generateDummyOffers(candidates.length > 0 ? candidates : generateDummyCandidates(50), 50); // Generate 50 offers
          dummyOffers.forEach(async (offer) => {
            await addDoc(offersColRef, { ...offer, createdBy: userId });
          });
          console.log("Added initial dummy offers.");
        }

        // Check if employees collection is empty and populate if so
        const employeesDocs = await getDocs(employeesColRef);
        if (employeesDocs.empty) {
          const dummyEmployees = generateDummyEmployees(50); // Generate 50 employees
          dummyEmployees.forEach(async (employee) => {
            await addDoc(employeesColRef, { ...employee, createdBy: userId });
          });
          console.log("Added initial dummy employees.");
        }

        // Check if events collection is empty and populate if so
        const eventsDocs = await getDocs(eventsColRef);
        if (eventsDocs.empty) {
          const dummyEvents = generateDummyEvents(50); // Generate 50 events
          dummyEvents.forEach(async (event) => {
            await addDoc(eventsColRef, { ...event, createdBy: userId });
          });
          console.log("Added initial dummy events.");
        }
      };
      addInitialData();
    }
  }, [db, appId, userId]); // Depend on db and userId


  // --- Dummy Data Generation (used for initial population if Firestore is empty) ---
  const generateDummyCandidates = (count = 50) => { // Updated count to 50
    const candidates = [];
    const stages = ['Resume Reviewed', 'Screening', 'Assessment Taken', 'Interview - R1', 'Interview - R2', 'Offer Extended', 'Offer Accepted', 'Offer Rejected', 'On Hold'];
    const jobRoles = ['Software Engineer', 'Product Manager', 'HR Business Partner', 'Marketing Specialist', 'Data Analyst', 'UX Designer', 'DevOps Engineer', 'Sales Executive'];
    const locations = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'];

    for (let i = 1; i <= count; i++) {
      const name = `Candidate ${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)} ${i}`;
      const jobAppliedFor = jobRoles[Math.floor(Math.random() * jobRoles.length)];
      const stage = stages[Math.floor(Math.random() * stages.length)];
      const matchScore = Math.floor(Math.random() * (99 - 60 + 1)) + 60;
      const lastContactDate = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000); // Last 30 days
      const lastContact = lastContactDate.toISOString().split('T')[0];
      const email = `${name.replace(/\s/g, '.').toLowerCase()}@example.com`;
      const phone = `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const aadhaarNumber = `XXXX XXXX ${Math.floor(1000 + Math.random() * 9000)}`;
      const panNumber = `${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)}${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)}${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)}${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)}${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(64 + Math.floor(Math.random() * 26) + 1)}`;
      const currentCTC = Math.floor(500000 + Math.random() * 1500000); // 5L to 20L INR
      const expectedCTC = Math.floor(currentCTC * (1.1 + Math.random() * 0.2)); // 10-30% hike
      const noticePeriodDays = [0, 15, 30, 45, 60, 90][Math.floor(Math.random() * 6)];
      const noticePeriod = noticePeriodDays === 0 ? 'Immediate' : `${noticePeriodDays} days`;
      const willingToRelocate = Math.random() > 0.5 ? 'Yes' : 'No';
      const languages = ['English', 'Hindi', 'Kannada', 'Tamil', 'Marathi', 'Bengali'].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

      const baseSalary = Math.floor(expectedCTC * 0.7);
      const annualBonus = Math.floor(expectedCTC * 0.1);
      const equity = Math.random() > 0.3 ? `${Math.floor(1000 + Math.random() * 5000)} units (vesting over 4 years)` : 'N/A';
      const benefits = 'Health, Dental, Vision, PF, Gratuity';
      const allowances = Math.random() > 0.5 ? 'Transport, HRA' : 'None';
      const totalCompensation = baseSalary + annualBonus; // Simplified

      const interviewFeedback = [
          { round: 'Screening', interviewer: 'HR Recruiter', date: '2025-05-10', score: Math.floor(Math.random() * 5) + 3, comments: 'Good communication, relevant experience mentioned.' },
          { round: 'Interview - R1', interviewer: 'Engineering Lead', date: '2025-05-15', score: Math.floor(Math.random() * 5) + 3, comments: 'Solid technical skills, needs work on system design.' }
      ].slice(0, Math.floor(Math.random() * 3)); // 0 to 2 feedbacks

      const communications = [
          { type: 'Email', date: '2025-05-01', subject: 'Application Received - Software Engineer', snippet: 'Dear Candidate, Thank you for your application...' },
          { type: 'SMS', date: '2025-05-09', subject: 'Interview Confirmation', snippet: 'Hi! Your interview with HR is scheduled for 2025-05-10.' }
      ].slice(0, Math.floor(Math.random() * 3)); // 0 to 2 communications

      candidates.push({
        id: `cand${i}`,
        name,
        jobAppliedFor,
        stage,
        matchScore,
        lastContact,
        email,
        phone,
        aadhaarNumber,
        panNumber,
        currentCTC,
        expectedCTC,
        noticePeriod,
        willingToRelocate,
        languages,
        resumeHighlights: {
          education: `Degree in ${jobAppliedFor.split(' ')[0]} from Indian University`,
          experience: `${Math.floor(Math.random() * 10) + 2} years in ${jobAppliedFor.split(' ')[0]}`,
          skills: ['JavaScript', 'Cloud', 'Analytics', 'Project Mgmt', 'Marketing', 'HR Policy'].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 2),
        },
        compensation: {
          baseSalary,
          annualBonus,
          equity,
          benefits,
          allowances,
          totalCompensation,
        },
        internalNotes: `Recruiter note: Follow up on notice period. Manager feedback pending.`,
        interviewFeedback,
        communications,
        videoPitchUrl: Math.random() > 0.7 ? `https://placehold.co/100x60/34D399/FFFFFF?text=Video+Pitch` : null
      });
    }
    return candidates;
  };

  const generateDummyOffers = (existingCandidates, count = 50) => { // Updated count to 50
    const offers = [];
    const statusOptions = ['Accepted', 'Pending', 'Declined'];
    const offeredCandidates = new Set(); // To ensure unique candidates get offers for demo purposes

    const candidatesToUse = existingCandidates.length > 0 ? existingCandidates : generateDummyCandidates(50); // Fallback if no candidates loaded yet

    while (offers.length < count && offeredCandidates.size < candidatesToUse.length) {
      const candidate = candidatesToUse[Math.floor(Math.random() * candidatesToUse.length)];
      if (offeredCandidates.has(candidate.id)) {
        continue;
      }
      offeredCandidates.add(candidate.id);

      const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
      const baseSalary = (candidate.compensation?.baseSalary || candidate.expectedCTC || 700000);
      const bonus = (candidate.compensation?.annualBonus || 50000);

      offers.push({
        id: `offer${offers.length + 1}`,
        candidate: candidate.name,
        job: candidate.jobAppliedFor,
        status: status,
        baseSalary: formatINR(baseSalary),
        bonus: formatINR(bonus),
      });
    }
    return offers;
  };


  const generateDummyEmployees = (count = 50) => { // Updated count to 50
    const employees = [];
    const departments = ['Engineering', 'Product', 'Human Resources', 'Marketing', 'Sales', 'Finance', 'Operations'];
    const jobTitles = {
      'Engineering': ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager'],
      'Product': ['Product Manager', 'Senior Product Manager', 'VP Product'],
      'Human Resources': ['HR Business Partner', 'HR Manager', 'Talent Acquisition Specialist'],
      'Marketing': ['Marketing Specialist', 'Content Creator', 'Marketing Manager'],
      'Sales': ['Sales Executive', 'Account Manager', 'Sales Director'],
      'Finance': ['Financial Analyst', 'Accountant'],
      'Operations': ['Operations Manager', 'Office Administrator']
    };
    const employmentStatus = ['Active', 'On Leave', 'Terminated'];
    const locations = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'];

    for (let i = 1; i <= count; i++) {
      const firstName = ['Aisha', 'Dev', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Meera', 'Arjun'][Math.floor(Math.random() * 8)];
      const lastName = ['Sharma', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Patel', 'Jain', 'Das'][Math.floor(Math.random() * 8)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      const titleOptions = jobTitles[department] || ['Employee'];
      const jobTitle = titleOptions[Math.floor(Math.random() * titleOptions.length)];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
      const phone = `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const status = employmentStatus[Math.floor(Math.random() * employmentStatus.length)];
      const hireDate = new Date(2020 - Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1); // Hired in last 5 years
      const employeeId = `EMP${1000 + i}`;
      const baseSalary = Math.floor(500000 + Math.random() * 2000000); // 5L to 25L
      const annualCTC = baseSalary + Math.floor(Math.random() * 500000);
      const location = locations[Math.floor(Math.random() * locations.length)];

      employees.push({
        id: employeeId,
        name: `${firstName} ${lastName}`,
        department,
        jobTitle,
        email,
        phone,
        status,
        hireDate: hireDate.toISOString().split('T')[0],
        annualCTC: formatINR(annualCTC),
        location,
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        dob: `19${Math.floor(70 + Math.random() * 20)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        address: `${Math.floor(Math.random() * 100) + 1} Main St, ${location}`,
        emergencyContact: {
          name: `Relative ${lastName}`,
          phone: `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          relationship: 'Spouse'
        },
        bankDetails: `Account: XXXX${Math.floor(1000 + Math.random() * 9000)}`,
        documents: ['Offer Letter', 'Contract', 'PAN Card', 'Aadhaar Card', 'Form 16'],
        benefitsEnrollment: {
          healthInsurance: Math.random() > 0.3,
          providentFund: true,
          gratuity: true,
          nps: Math.random() > 0.5
        },
        leaveBalance: {
          sick: Math.floor(Math.random() * 10) + 5,
          casual: Math.floor(Math.random() * 10) + 5,
          earned: Math.floor(Math.random() * 15) + 10
        },
        performanceReviewSummary: `Last review: ${new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}, Rating: ${Math.floor(Math.random() * 3) + 3}/5`
      });
    }
    return employees;
  };


  const generateDummyEvents = (count = 50) => { // Updated count to 50
    const events = [];
    const eventTypes = ['Interview', 'Meeting', 'Task Deadline', 'Candidate Follow-up', 'HR Meeting'];
    const descriptions = [
      'Candidate initial screening call',
      'Team sync on hiring pipeline',
      'Complete offer letter for John Doe',
      'Follow up with Sarah for documents',
      'Quarterly HR review meeting',
      'Interview with Senior SWE candidate',
      'Review resumes for PM role',
      'Onboarding session for new hire',
      'Payroll submission deadline',
      'Tax declaration reminder'
    ];

    for (let i = 0; i < count; i++) {
      const daysOffset = Math.floor(Math.random() * 60) - 30; // Events in last 30 days to next 30 days
      const date = new Date();
      date.setDate(date.getDate() + daysOffset);

      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];
      const time = `${Math.floor(Math.random() * 12) + 9}:00 ${Math.random() > 0.5 ? 'AM' : 'PM'}`;

      events.push({
        id: `event${i}`,
        date: date.toISOString().split('T')[0], //YYYY-MM-DD
        type,
        description,
        time,
      });
    }
    return events;
  };


  const dummyMetrics = {
    activeCandidates: candidates.filter(c => c.stage !== 'Offer Accepted' && c.stage !== 'Offer Rejected').length,
    offersExtended: offers.length,
    avgTimeToHire: '32 Days', // This would ideally be calculated from Firestore data
    offerAcceptanceRate: `${(offers.filter(o => o.status === 'Accepted').length / offers.length * 100).toFixed(0) || 0}%`,
    applicationsToday: `${Math.floor(Math.random() * 20) + 5}`, // Random for now
    interviewsScheduled: `${Math.floor(Math.random() * 10) + 3}`, // Random for now
    openJobRequisitions: Math.floor(Math.random() * 10) + 5, // Random for now
    pendingApprovals: Math.floor(Math.random() * 3) + 1, // Random for now
    virtualEventsScheduled: Math.floor(Math.random() * 5) + 1, // Random for now
  };

  const dummyAnalyticsData = { // These would ideally be derived from Firestore data too
    hiringFunnel: {
      applied: candidates.length + Math.floor(Math.random() * 100) + 100, // Derived
      screened: candidates.filter(c => c.stage !== 'Resume Reviewed').length + Math.floor(Math.random() * 50), // Derived
      interviewed: candidates.filter(c => c.stage.includes('Interview') || c.stage === 'Offer Extended' || c.stage === 'Offer Accepted').length, // Derived
      offered: offers.length, // Derived
      hired: offers.filter(o => o.status === 'Accepted').length, // Derived
    },
    sourceEffectiveness: [
      { source: 'LinkedIn', hires: Math.floor(Math.random() * 10) + 5 },
      { source: 'Referral', hires: Math.floor(Math.random() * 8) + 3 },
      { source: 'Indeed', hires: Math.floor(Math.random() * 7) + 2 },
      { source: 'Company Website', hires: Math.floor(Math.random() * 5) + 1 },
      { source: 'Others', hires: Math.floor(Math.random() * 3) + 1 },
    ].filter(s => s.hires > 0),
    timeInStage: {
      appliedToScreened: '5 days',
      screenedToInterview: '7 days',
      interviewToOffer: '10 days',
    },
    predictedTalentShortage: '3 months (Data Science)',
    retentionRateLastYear: '88%',
  };


  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);

    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  const handleCandidateClick = (candidateId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    setSelectedCandidate(candidate);
    setActiveTab('candidates');
  };

  const handleBackToCandidates = () => {
    setSelectedCandidate(null);
  };

  const handleUpdateCandidateStage = useCallback(async (candidateId, newStage) => {
    if (!db || !appId) {
      showNotification("Database not available for update.", "error");
      return;
    }
    try {
      const candidateDocRef = doc(db, `artifacts/${appId}/public/data/candidates`, candidateId);
      await updateDoc(candidateDocRef, { stage: newStage });
      showNotification("Candidate stage updated in database!", "success");
    } catch (error) {
      console.error("Error updating candidate stage:", error);
      showNotification("Failed to update candidate stage.", "error");
    }
  }, [db, appId, showNotification]);


  const handleUpdateUserName = useCallback((newName) => {
    setCurrentUserDisplayName(newName);
    // In a real app, this would update user profile in Firebase Auth
    // updateProfile(auth.currentUser, { displayName: newName }).then(...)
    showNotification("User display name updated (client-side only for demo).", "info");
  }, [showNotification]);

  const handleUpdateUserPassword = useCallback((newPwd) => {
    // This is a client-side only update for demonstration.
    // In a real application, this would involve backend authentication.
    console.log("Password updated successfully (frontend only).");
    showNotification("Password updated (client-side only for demo).", "info");
  }, [showNotification]);

  // Function to download candidate data as CSV
  const handleDownloadCandidates = () => {
    const headers = [
      "ID", "Name", "Job Applied For", "Current Stage", "AI Match Score", "Last Contact",
      "Email", "Phone", "Aadhaar Number", "PAN Number", "Current CTC", "Expected CTC",
      "Notice Period", "Willing to Relocate", "Languages", "Education", "Experience", "Skills"
    ];

    const csvRows = candidates.map(c => { // Use fetched candidates data
      const row = [
        c.id, c.name, c.jobAppliedFor, c.stage, c.matchScore, c.lastContact,
        c.email, c.phone, c.aadhaarNumber, c.panNumber, c.currentCTC, c.expectedCTC,
        c.noticePeriod, c.willingToRelocate, (c.languages || []).join('; '),
        c.resumeHighlights?.education, c.resumeHighlights?.experience, (c.resumeHighlights?.skills || []).join('; ')
      ];
      // Escape commas and wrap in quotes for CSV
      return row.map(item => {
        if (typeof item === 'string' && item.includes(',')) {
          return `"${item.replace(/"/g, '""')}"`;
        }
        return item;
      }).join(',');
    });

    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'sapphire_hr_candidates.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Candidate data downloaded successfully!', 'success');
    }
  };


  const renderContent = () => {
    if (activeTab === 'candidates' && selectedCandidate) {
      return (
        <CandidateDetailView
          candidate={selectedCandidate}
          onBack={handleBackToCandidates}
          onUpdateCandidateStage={handleUpdateCandidateStage}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card title="Active Candidates" value={dummyMetrics.activeCandidates} icon={Users} colorClass="text-green-400" />
            <Card title="Offers Extended" value={dummyMetrics.offersExtended} icon={DollarSign} colorClass="text-purple-400" />
            <Card title="Avg. Time to Hire" value={dummyMetrics.avgTimeToHire} icon={FileText} colorClass="text-orange-400" />
            <Card title="Offer Acceptance Rate" value={dummyMetrics.offerAcceptanceRate} icon={Layers} colorClass="text-teal-400" />
            <Card title="Applications Today" value={dummyMetrics.applicationsToday} icon={MessageSquare} colorClass="text-red-400" />
            <Card title="Interviews Scheduled" value={dummyMetrics.interviewsScheduled} icon={Briefcase} colorClass="text-indigo-400" />
            {/* New ATS Dashboard Cards */}
            <Card title="Open Job Requisitions" value={dummyMetrics.openJobRequisitions} icon={Plus} colorClass="text-yellow-400" />
            <Card title="Pending Req. Approvals" value={dummyMetrics.pendingApprovals} icon={ThumbsUp} colorClass="text-pink-400" />
            <Card title="Virtual Events Scheduled" value={dummyMetrics.virtualEventsScheduled} icon={BriefcaseBusiness} colorClass="text-blue-400" />

            {/* Source & Attract features */}
            <div className={`p-6 rounded-lg shadow-md md:col-span-1 lg:col-span-1 flex flex-col justify-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Source & Attract</h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Candidate sourcing**: Advanced search and discovery tools to find top talent.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Job advertising**: Create and publish ads across platforms.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Careers site**: Customizable career pages for brand consistency.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Source boosters**: Tools to amplify reach and attract diverse candidates.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Social Recruiting**: Share jobs easily on social media.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Employee referral**: Streamlined referral program management.
              </p>
            </div>

            {/* Track & Engage features */}
            <div className={`p-6 rounded-lg shadow-md md:col-span-1 lg:col-span-1 flex flex-col justify-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Track & Engage</h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Hiring pipeline**: Visual tracking of candidates through all stages.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Resume management**: Centralized storage and AI parsing of resumes.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Manage Submissions**: Efficiently process and review incoming applications.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Background screening**: Initiate and track checks directly.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Hiring analytics**: In-depth reports on recruitment performance.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Assessments**: Administer and review candidate evaluations.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Video Interview**: Conduct and record virtual interviews.
              </p>
            </div>

             {/* Automate & Hire features */}
             <div className={`p-6 rounded-lg shadow-md md:col-span-1 lg:col-span-1 flex flex-col justify-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Automate & Hire</h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Blueprint**: Build automated workflows for repetitive tasks.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **AI Recruitment**: Leverage AI for intelligent matching, screening, and engagement.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Offer letter**: Generate, send, and track offer letters seamlessly.
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                **Onboarding**: Streamlined new hire onboarding experience.
              </p>
            </div>

          </div>
        );
      case 'candidates':
        return (
          <div>
            <h2 className={`text-xl font-semibold mb-4 flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Candidates
              <button
                onClick={handleDownloadCandidates}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95"
                aria-label="Download Candidate Data"
              >
                <Download size={16} /> <span>Download Data (CSV)</span>
              </button>
            </h2>
            <div className={`overflow-x-auto rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <table className="min-w-full divide-y divide-zinc-700">
                <thead className={theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Candidate Name</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Applied For (Job)</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Current Stage</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>AI Match Score</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Last Contact</th>
                  </tr>
                </thead>
                <tbody className={theme === 'dark' ? 'bg-zinc-800 divide-y divide-zinc-700' : 'bg-white divide-y divide-gray-200'}>
                  {candidates.map(candidate => ( // Use fetched candidates data
                    <tr key={candidate.id} className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'}`} onClick={() => handleCandidateClick(candidate.id)}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-400 hover:underline ${theme === 'dark' ? '' : 'text-blue-600'}`}>{candidate.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.jobAppliedFor}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.stage}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-400`}>{candidate.matchScore}%</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{candidate.lastContact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
             {/* Bulk Actions */}
            <div className={`mt-6 p-4 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
              <h3 className={`text-lg font-semibold mb-3 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}><Workflow size={20} /> Bulk Actions & Automation Triggers</h3>
              <p className="text-sm">
                Select multiple candidates to perform actions simultaneously (e.g., send bulk email, update status, initiate assessments).
                You can also set up automated rules (e.g., "If candidate is rejected, send automated rejection email.").
              </p>
              <button className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Perform Bulk Actions">
                Perform Bulk Actions
              </button>
            </div>
          </div>
        );
      case 'offers':
        return (
          <div>
            <h2 className={`text-xl font-semibold mb-4 flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Offer Management
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-transform transform hover:scale-105 active:scale-95" aria-label="New Offer">
                <Plus size={18} /> <span>New Offer</span>
              </button>
            </h2>
            <div className={`overflow-x-auto rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <table className="min-w-full divide-y divide-zinc-700">
                <thead className={theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Candidate</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Job Title</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Status</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Base Salary</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Bonus</th>
                  </tr>
                </thead>
                <tbody className={theme === 'dark' ? 'bg-zinc-800 divide-y divide-zinc-700' : 'bg-white divide-y divide-gray-200'}>
                  {offers.map(offer => ( // Use fetched offers data
                    <tr key={offer.id}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{offer.candidate}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{offer.job}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          offer.status === 'Accepted' ? 'bg-blue-600/20 text-blue-300' : 'bg-orange-600/20 text-orange-300'
                        }`}>
                          {offer.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{offer.baseSalary}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{offer.bonus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'analytics':
        // Prepare data for Hiring Funnel Bar Chart
        const hiringFunnelData = [
          { name: 'Applied', value: dummyAnalyticsData.hiringFunnel.applied },
          { name: 'Screened', value: dummyAnalyticsData.hiringFunnel.screened },
          { name: 'Interviewed', value: dummyAnalyticsData.hiringFunnel.interviewed },
          { name: 'Offered', value: dummyAnalyticsData.hiringFunnel.offered },
          { name: 'Hired', value: dummyAnalyticsData.hiringFunnel.hired },
        ];

        // Prepare data for Source Effectiveness Pie Chart
        const sourceEffectivenessData = dummyAnalyticsData.sourceEffectiveness.map(item => ({
          name: item.source,
          value: item.hires,
        }));
        const PIE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c']; // Custom colors for pie chart

        return (
          <div>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>HR Analytics & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Hiring Funnel Chart */}
              <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Hiring Funnel</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hiringFunnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#525252' : '#e0e0e0'} />
                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#a3a3a3' : '#6b7280'} />
                    <YAxis stroke={theme === 'dark' ? '#a3a3a3' : '#6b7280'} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#ffffff', border: theme === 'dark' ? 'none' : '1px solid #e0e0e0', borderRadius: '8px' }}
                      labelStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}
                      itemStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}
                    />
                    <Legend wrapperStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }} />
                    <Bar dataKey="value" fill="#8884d8" name="Count" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Conversion Rate (Applied to Hired): ${(dummyAnalyticsData.hiringFunnel.hired / dummyAnalyticsData.hiringFunnel.applied * 100).toFixed(1)}%</p>
                <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>AI-driven Bottleneck Identification and Predictive Funnel insights are available here.</p>
              </div>

              {/* Source Effectiveness Chart */}
              <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Source Effectiveness (Hires)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceEffectivenessData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {sourceEffectivenessData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#ffffff', border: theme === 'dark' ? 'none' : '1px solid #e0e0e0', borderRadius: '8px' }}
                      labelStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}
                      itemStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}
                    />
                    <Legend wrapperStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }} />
                  </PieChart>
                </ResponsiveContainer>
                <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Detailed Source Analytics and Recommendation Engine insights are part of Hiring Analytics.</p>
              </div>

              <div className={`p-6 rounded-lg shadow-md md:col-span-2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Time in Stage (Average) - Hiring Pipeline Insights</h3>
                <ul className={`text-sm space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li className="flex justify-between"><span>Applied to Screened:</span> <span className="font-bold">{dummyAnalyticsData.timeInStage.appliedToScreened}</span></li>
                  <li className="flex justify-between"><span>Screened to Interview:</span> <span className="font-bold">{dummyAnalyticsData.timeInStage.screenedToInterview}</span></li>
                  <li className="flex justify-between"><span>Interview to Offer:</span> <span className="font-bold">{dummyAnalyticsData.timeInStage.interviewToOffer}</span></li>
                </ul>
                <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Further drill-down and Natural Language Query (NLQ) capabilities for custom reports, providing deep Hiring Analytics.</p>
              </div>

              {/* New Analytics Cards */}
              <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Post-Hire Performance & Retention</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Last Year Retention Rate: <span className="font-bold text-green-400">{dummyAnalyticsData.retentionRateLastYear}</span></p>
                <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Deep integration with HRIS analyzes performance data and continuously refines AI's quality of hire predictions, optimizing hiring strategy for retention and performance.</p>
              </div>
            </div>
          </div>
        );
      case 'payroll-onboarding':
        return (
          <div>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Payroll & Onboarding</h2>
            <div className={`p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-zinc-800 text-gray-300' : 'bg-white text-gray-700'}`}>
              <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Manage new hire payroll data and seamless onboarding:</p>
              <form className="space-y-4">
                <div>
                  <label htmlFor="legalName" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Legal Name</label>
                  <input type="text" id="legalName" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} placeholder="John Doe" aria-label="Legal Name" />
                </div>
                <div>
                  <label htmlFor="aadhaar" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Aadhaar Number</label>
                  <input type="text" id="aadhaar" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} placeholder="XXXX XXXX XXXX" aria-label="Aadhaar Number" />
                </div>
                <div>
                  <label htmlFor="pan" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>PAN Number</label>
                  <input type="text" id="pan" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} placeholder="ABCDE1234F" aria-label="PAN Number" />
                </div>
                <div>
                  <label htmlFor="startDate" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Start Date</label>
                  <input type="date" id="startDate" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} aria-label="Start Date" />
                </div>
                <div>
                  <label htmlFor="salary" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Agreed Salary (INR)</label>
                  <input type="number" id="salary" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} placeholder="e.g., 750000" aria-label="Agreed Salary" />
                </div>
                <div>
                  <label htmlFor="noticePeriod" className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-800'}`}>Notice Period (Days)</label>
                  <input type="number" id="noticePeriod" className={`mt-1 block w-full p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`} placeholder="e.g., 30" aria-label="Notice Period in Days" />
                </div>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>All necessary payroll PII and banking details are securely captured here with compliance checks, prior to secure API push to payroll systems.</p>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Initiate Payroll Handoff">
                  Initiate Payroll Handoff
                </button>
              </form>
              <p className={`mt-6 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                This module also handles onboarding checklists, document signing, and seamless integration with broader HRIS/HRMS systems.
                It can trigger automated pre-boarding and first-day experience tasks, including welcome kits and team introductions, reducing new hire anxiety.
              </p>
            </div>
          </div>
        );
      case 'hris':
        return <HRISPage employees={employees} />; // Use fetched employees data
      case 'ai-chatbot':
        return (
          <div>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>AI Assistant & Natural Language Query</h2>
            <div className={`p-6 rounded-lg shadow-md h-96 flex flex-col ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
              <div className={`flex-1 overflow-y-auto p-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-zinc-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                <div className={`text-center mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Chat history with Sapphire HR AI Assistant</div>
                <div className={`mb-2 p-2 rounded-lg max-w-[80%] ${theme === 'dark' ? 'bg-zinc-600' : 'bg-blue-50'}`}>
                  <p className="font-bold text-blue-400">AI Assistant:</p>
                  <p>Hello! How can I help you with your recruitment tasks today?</p>
                </div>
                <div className={`mb-2 ml-auto p-2 rounded-lg max-w-[80%] text-right ${theme === 'dark' ? 'bg-blue-700' : 'bg-blue-200'}`}>
                  <p className="font-bold text-blue-200">You:</p>
                  <p>Show me candidates for the 'Senior Software Engineer' role who passed round 1 interview.</p>
                </div>
                <div className={`mb-2 p-2 rounded-lg max-w-[80%] ${theme === 'dark' ? 'bg-zinc-600' : 'bg-blue-50'}`}>
                  <p className="font-bold text-blue-400">AI Assistant:</p>
                  <p>Fetching candidates for 'Senior Software Engineer' who are in 'Interview - R1' stage...</p>
                  <p className="mt-1">Alice Johnson (AI Match: 92%), Eve Adams (AI Match: 85%)</p>
                </div>
                <div className={`mb-2 ml-auto p-2 rounded-lg max-w-[80%] text-right ${theme === 'dark' ? 'bg-blue-700' : 'bg-blue-200'}`}>
                  <p className="font-bold text-blue-200">You:</p>
                  <p>Which source brings candidates with the highest offer acceptance rate in sales?</p>
                </div>
                 <div className={`mb-2 p-2 rounded-lg max-w-[80%] ${theme === 'dark' ? 'bg-zinc-600' : 'bg-blue-50'}`}>
                  <p className="font-bold text-blue-400">AI Assistant:</p>
                  <p>Analyzing offer acceptance rates for sales roles by source... LinkedIn currently shows the highest acceptance rate at 75% for sales positions.</p>
                </div>
                <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>This AI Chatbot serves as a "Recruiter Co-pilot" to assist with outreach, follow-ups, and enables Natural Language Queries (NLQ) for quick reporting and data insights.</p>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Ask the AI Assistant or use Natural Language Query..."
                  className={`flex-1 p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                  aria-label="Ask AI Assistant"
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Send message">Send</button>
              </div>
            </div>
          </div>
        );
      case 'ctc-tax-calculator':
        return <CTCTaxCalculator />;
      case 'calendar':
        return <CalendarView events={events} />; // Use fetched events data
      case 'settings':
        return (
          <SettingsPage
            userDisplayName={currentUserDisplayName}
            userRole={currentUserRole}
            onUpdateUserName={handleUpdateUserName}
            onUpdateUserPassword={handleUpdateUserPassword}
            handleLogout={handleLogout}
          />
        );
      default:
        return <div className={`text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Select a navigation item to view content.</div>;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-inter ${theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'}`}>
      {/* Mobile Navigation Toggle Button */}
      {isMobileView && (
        <button
          className={`md:hidden p-4 flex items-center justify-between shadow-md transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'}`}
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-nav"
          aria-label="Toggle navigation menu"
        >
          <span className="font-bold text-base">Sapphire HR Menu</span>
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {isMobileNavOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      )}

      {/* Sidebar Navigation */}
      <nav
        id="mobile-nav"
        className={`fixed inset-y-0 left-0 w-64 p-6 shadow-xl z-20 md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${
          theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-blue-800 text-white'
        } ${
          isMobileView ? (isMobileNavOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        }`}
        aria-label="Main navigation"
      >
        <div className="text-2xl font-extrabold mb-8 text-blue-400">Sapphire HR</div>
        <ul className="space-y-4">
          <li><NavItem icon={Home} text="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={Users} text="Candidates" isActive={activeTab === 'candidates'} onClick={() => { setActiveTab('candidates'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={FileText} text="Offers" isActive={activeTab === 'offers'} onClick={() => { setActiveTab('offers'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={TrendingUp} text="Analytics" isActive={activeTab === 'analytics'} onClick={() => { setActiveTab('analytics'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={Server} text="HRIS" isActive={activeTab === 'hris'} onClick={() => { setActiveTab('hris'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={CreditCard} text="Payroll & Onboarding" isActive={activeTab === 'payroll-onboarding'} onClick={() => { setActiveTab('payroll-onboarding'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={Calculator} text="CTC & Tax Calculator" isActive={activeTab === 'ctc-tax-calculator'} onClick={() => { setActiveTab('ctc-tax-calculator'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={CalendarIcon} text="Calendar" isActive={activeTab === 'calendar'} onClick={() => { setActiveTab('calendar'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={MessageSquare} text="AI Chatbot" isActive={activeTab === 'ai-chatbot'} onClick={() => { setActiveTab('ai-chatbot'); setIsMobileNavOpen(false); }} /></li>
          <li><NavItem icon={Settings} text="Settings" isActive={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileNavOpen(false); }} /></li>
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 p-4 md:p-8 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        {/* Overlay for mobile nav when open */}
        {isMobileView && isMobileNavOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-10"
            onClick={() => setIsMobileNavOpen(false)}
            role="presentation"
          ></div>
        )}

        {/* Header for main content */}
        <header className={`mb-8 p-4 rounded-xl shadow-md flex items-center justify-between ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace(/-/g, ' ')} Overview
          </h1>
          {/* User profile / notifications / Theme Toggle / Unified Search */}
          <div className="flex items-center space-x-4">
             {/* Unified Search Bar */}
            <div className={`relative ${isMobileView ? 'hidden md:block' : ''}`}>
              <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              <input
                type="text"
                placeholder="Search across ATS..."
                className={`w-40 md:w-60 p-2 pl-10 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
                aria-label="Search across ATS"
              />
            </div>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-zinc-900'}`}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className={`flex flex-col items-end text-xs truncate max-w-[120px] md:max-w-none ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              <span>Hello, {currentUserDisplayName.split(' ')[0]}!</span>
              <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>({currentUserRole})</span>
              {user?.uid && <span className={`text-gray-500 text-[10px]`}>ID: {user.uid}</span>} {/* Display userId */}
            </div>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center space-x-2 text-sm transition-transform transform hover:scale-105 active:scale-95" aria-label="Logout">
              <LogOut size={20} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Dynamic content rendering */}
        <div className={`p-6 rounded-xl shadow-2xl border ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'}`}>
          {renderContent()}
        </div>

        {/* Footer (simple for demonstration) */}
        <footer className={`text-center text-xs mt-8 p-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          Sapphire HR © 2025. All rights reserved.
        </footer>
      </main>
    </div>
  );
};

// Login Page Component
const LoginPage = ({ setAppUser, authError, isLoading, auth, appId }) => {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { showNotification } = useNotification();


  // NOTE: Removed the useEffect for auto-login.
  // Now, the user must explicitly enter credentials to log in.

  // Mock login for demonstration 
  const handleMockLogin = useCallback(async (user, pwd) => {
    setLoginError('');
    if (user === 'Akshay Arvind' && pwd === 'admin') {
      const mockUser = {
        // For demonstration, directly set a mock UID.
        // In a real app, this would be a Firebase user.uid from a successful sign-in.
        uid: 'mock-akshay-arvind-uid', 
        displayName: 'Akshay Arvind',
        email: 'akshay.arvind@example.com',
      };
      setAppUser(mockUser);
      if (rememberMe) {
        localStorage.setItem('mockUser', JSON.stringify({ username: user, password: pwd }));
      } else {
        localStorage.removeItem('mockUser');
      }
      showNotification('Login successful!', 'success');
      // In a real Firebase app, you would integrate Firebase signInWithEmailAndPassword here
      // and update the user state with the result from Firebase.
    } else {
      setLoginError('Invalid username or password.');
      showNotification('Invalid username or password.', 'error');
    }
  }, [rememberMe, setAppUser, showNotification]);

  useEffect(() => {
    // Try to load remembered user if 'rememberMe' was checked previously
    const rememberedUser = localStorage.getItem('mockUser');
    if (rememberedUser) {
      try {
        const user = JSON.parse(rememberedUser);
        setUsername(user.username || '');
        setPassword(user.password || '');
        setRememberMe(true);
        // Automatically attempt login with remembered credentials if they exist
        handleMockLogin(user.username, user.password);
      } catch (e) {
        console.error("Error parsing remembered user from localStorage", e);
        localStorage.removeItem('mockUser');
      }
    }
  }, [handleMockLogin]); // Re-run if handleMockLogin changes (e.g., due to rememberMe state change)


  const handleLoginSubmit = (e) => {
    e.preventDefault();
    // This now directly triggers the mock login.
    handleMockLogin(username, password);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center font-inter p-4 ${theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'}`}>
      <div className={`p-8 rounded-lg shadow-xl max-w-md w-full text-center ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'}`}>
        <h2 className="text-3xl font-extrabold text-blue-400 mb-6">Sapphire HR</h2>
        <p className={`mb-8 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Your All-in-One HR Solution</p>

        {authError && <p className="text-red-500 text-sm mb-4" role="alert">{authError}</p>}
        {loginError && <p className="text-red-500 text-sm mb-4" role="alert">{loginError}</p>}

        <form onSubmit={handleLoginSubmit} className="space-y-4 mb-6">
          <div>
            <input
              type="text"
              placeholder="Username (Akshay Arvind)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full p-3 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
              required
              aria-label="Username"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password (admin)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-3 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-gray-100 border-gray-300 text-zinc-900'}`}
              required
              aria-label="Password"
            />
          </div>
          <div className="flex items-center justify-center text-sm">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 bg-zinc-700 border-zinc-600 rounded focus:ring-blue-500"
              aria-label="Remember me"
            />
            <label htmlFor="rememberMe" className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Remember Me</label>
          </div>
          <button
            type="submit"
            disabled={isLoading || !auth} // Disable if still loading Firebase or auth not ready
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full transition duration-300 flex items-center justify-center space-x-2"
            aria-busy={isLoading}
            aria-label="Login"
          >
            {isLoading ? (
              <Loader size={20} className="animate-spin" />
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        <p className={`text-xs mt-6 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          For demonstration, use 'Akshay Arvind' / 'admin' for mock login.
        </p>
      </div>
    </div>
  );
};


// Top-level App Component to handle Firebase Init and Auth State
const App = () => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Tracks initial Firebase loading
  const [isAuthReady, setIsAuthReady] = useState(false); // Tracks Firebase Auth state resolution

  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [appId, setAppId] = useState('');
  const [userId, setUserId] = useState('');

  // Firebase Initialization and Auth State Listener
  useEffect(() => {
    let firebaseAppInstance;
    let authUnsubscribe;

    const setupFirebase = async () => {
      try {
        // Retrieve global variables
        const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        setAppId(currentAppId);

        const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
        const firebaseConfig = firebaseConfigString ? JSON.parse(firebaseConfigString) : null;

        if (firebaseConfig) {
          firebaseAppInstance = initializeApp(firebaseConfig);
          const currentAuth = getAuth(firebaseAppInstance);
          const currentDb = getFirestore(firebaseAppInstance);
          setAuth(currentAuth);
          setDb(currentDb);

          // Listen for auth state changes
          authUnsubscribe = onAuthStateChanged(currentAuth, (currentUser) => {
            if (currentUser) {
              setUser(currentUser);
              setUserId(currentUser.uid); // Set actual Firebase UID
            } else {
              setUser(null);
              setUserId(''); // Clear user ID on logout
            }
            setIsAuthReady(true); // Auth state has been determined
            setIsLoading(false); // Finished initial loading
          });
          // Removed automatic signInWithCustomToken and signInAnonymously calls.
          // Login now relies on explicit user action via LoginPage.
        } else {
          console.warn("Firebase config not available. Proceeding with mock authentication only.");
          setAuth(null);
          setDb(null);
          // Fallback for Canvas environment without Firebase config (shouldn't happen if globals are set)
          setIsAuthReady(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        setAuthError(`Firebase initialization error: ${error.message}`);
        setIsLoading(false);
        setIsAuthReady(true);
      }
    };

    setupFirebase();

    // Cleanup function
    return () => {
      if (authUnsubscribe) {
        authUnsubscribe();
      }
      // You might also want to call app.delete() if firebaseAppInstance is managed here
      // but typically not needed for a single-page app's root.
    };
  }, []); // Empty dependency array means this runs once on mount


  const handleLogout = async () => {
    setIsLoading(true);
    setAuthError(null);

    // Clear any local mock user data if it exists
    localStorage.removeItem('mockUser');

    if (auth && auth.currentUser) {
      try {
        await signOut(auth); // Attempt Firebase logout
        setUser(null); // Clear user state after successful Firebase logout
        setUserId('');
        console.log("Logged out from Firebase.");
      } catch (error) {
        console.error("Error logging out from Firebase:", error);
        setAuthError(`Logout failed: ${error.message}`);
      }
    } else {
      // If no Firebase user, just clear mock user state
      setUser(null);
      setUserId('');
      console.log("Mock user logged out.");
    }
    setIsLoading(false);
  };

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center font-inter text-white text-xl">
        <Loader size={32} className="animate-spin mr-3" aria-label="Loading application" /> Loading Application...
      </div>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider>
        {user ? (
          <MainLayout
            user={user}
            handleLogout={handleLogout}
            db={db}
            auth={auth}
            appId={appId}
            userId={userId}
          />
        ) : (
          <LoginPage
            setAppUser={setUser}
            authError={authError}
            isLoading={isLoading}
            auth={auth} // Pass auth to LoginPage for potential manual sign-in if needed
            appId={appId}
          />
        )}
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;

